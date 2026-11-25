package fr.bridgeclubsaintorens.pptpe.acr;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.acs.smartcardio.BluetoothSmartCard;
import com.acs.smartcardio.BluetoothTerminalManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import javax.smartcardio.Card;
import javax.smartcardio.CardException;
import javax.smartcardio.CardTerminal;
import javax.smartcardio.CommandAPDU;
import javax.smartcardio.ResponseAPDU;

/**
 * Lit l'UID des cartes NFC présentées sur un ACS ACR1555U connecté en Bluetooth LE.
 * Événements : "status" ({ status, message, terminal? }) et "uid" ({ uid, terminal }).
 */
@CapacitorPlugin(name = "AcrReader")
public class AcrReaderPlugin extends Plugin {

    private static final String TAG = "AcrReader";
    private static final long SCAN_TIMEOUT_MS = 20_000;
    private static final long SCAN_RETRY_DELAY_MS = 5_000;
    // Attente courte : la boucle de lecture joue aussi les bips demandés par l'application.
    private static final long CARD_WAIT_MS = 250;
    private static final int MAX_CONSECUTIVE_ERRORS = 3;
    private static final byte[] GET_UID_APDU = {(byte) 0xFF, (byte) 0xCA, 0x00, 0x00, 0x00};
    private static final int MIN_BEEP_MS = 10;
    private static final int MAX_BEEP_MS = 2_550;
    private static final long BEEP_GAP_MS = 120;

    private final Object lock = new Object();
    private final LinkedBlockingQueue<int[]> beeps = new LinkedBlockingQueue<>();
    private BluetoothTerminalManager manager;
    private Thread worker;
    private volatile CardTerminal terminal;

    @Override
    public void load() {
        manager = BluetoothSmartCard.getInstance(getContext()).getManager();
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (manager == null) {
            call.reject("Bluetooth LE indisponible sur cet appareil.");
            return;
        }
        if (!hasBluetoothPermissions()) {
            emitStatus("permission", "Autorisez « Appareils à proximité » pour ppBCSTO.", null);
            call.reject("Permissions Bluetooth manquantes.");
            return;
        }
        synchronized (lock) {
            if (worker == null || !worker.isAlive()) {
                worker = new Thread(this::runLoop, "acr1555u-reader");
                worker.start();
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopWorker();
        emitStatus("stopped", "Lecteur ACR1555U arrêté.", null);
        call.resolve();
    }

    /** Fait biper l'ACR1555U : { durations: [ms, ...] }, bips séparés d'une courte pause. */
    @PluginMethod
    public void beep(PluginCall call) {
        JSArray values = call.getArray("durations");
        if (values == null || values.length() == 0) {
            call.reject("Durées de bip manquantes.");
            return;
        }
        if (terminal == null) {
            call.reject("Lecteur ACR1555U non connecté.");
            return;
        }
        int[] durations = new int[values.length()];
        for (int i = 0; i < durations.length; i++) {
            durations[i] = Math.max(MIN_BEEP_MS, Math.min(MAX_BEEP_MS, values.optInt(i, 100)));
        }
        beeps.offer(durations);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        stopWorker();
        super.handleOnDestroy();
    }

    private void stopWorker() {
        Thread current;
        synchronized (lock) {
            current = worker;
            worker = null;
        }
        if (current != null) {
            current.interrupt();
        }
        stopScanQuietly();
        disconnectTerminal();
    }

    private void runLoop() {
        while (!Thread.currentThread().isInterrupted()) {
            try {
                CardTerminal found = scanForReader();
                if (found == null) {
                    emitStatus("not-found",
                            "ACR1555U introuvable. Allumez-le (voyant bleu clignotant).", null);
                    Thread.sleep(SCAN_RETRY_DELAY_MS);
                    continue;
                }
                terminal = found;
                readCards(found);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        disconnectTerminal();
    }

    private CardTerminal scanForReader() throws InterruptedException {
        emitStatus("scanning", "Recherche du lecteur ACR1555U…", null);
        AtomicReference<CardTerminal> result = new AtomicReference<>();
        CountDownLatch found = new CountDownLatch(1);
        manager.startScan(BluetoothTerminalManager.TERMINAL_TYPE_ACR1555U, candidate -> {
            // Le lecteur expose deux terminaux : "… PICC" (sans contact) et "… SAM".
            if (candidate != null && candidate.getName().toUpperCase(Locale.ROOT).endsWith("PICC")
                    && result.compareAndSet(null, candidate)) {
                found.countDown();
            }
        });
        try {
            found.await(SCAN_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } finally {
            stopScanQuietly();
        }
        return result.get();
    }

    private void readCards(CardTerminal reader) throws InterruptedException {
        int consecutiveErrors = 0;
        boolean announced = false;
        while (!Thread.currentThread().isInterrupted()) {
            try {
                if (!announced) {
                    reader.isCardPresent();
                    emitStatus("ready", "Lecteur prêt : présentez une carte.", reader.getName());
                    announced = true;
                }
                if (!reader.waitForCardPresent(CARD_WAIT_MS)) {
                    playPendingBeeps(reader);
                    consecutiveErrors = 0;
                    continue;
                }
                String uid = readUid(reader);
                if (uid != null) {
                    JSObject event = new JSObject();
                    event.put("uid", uid);
                    event.put("terminal", reader.getName());
                    notifyListeners("uid", event);
                }
                // Une seule lecture par présentation : attendre le retrait de la carte.
                // Le verdict arrive souvent carte encore posée : jouer les bips pendant l'attente.
                while (!reader.waitForCardAbsent(CARD_WAIT_MS)) {
                    if (Thread.currentThread().isInterrupted()) return;
                    playPendingBeeps(reader);
                }
                consecutiveErrors = 0;
            } catch (CardException e) {
                if (e.getCause() instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                    return;
                }
                consecutiveErrors++;
                Log.w(TAG, "Erreur lecteur (" + consecutiveErrors + ")", e);
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    emitStatus("error", "Lecteur injoignable, nouvelle recherche…", reader.getName());
                    disconnectTerminal();
                    return;
                }
                Thread.sleep(CARD_WAIT_MS);
            }
        }
    }

    /**
     * Joue les bips en attente via la commande d'échappement ACS « Buzzer Control »
     * (E0 00 00 28 01 durée, par pas de 10 ms ; manuel ACR1555U v2.02 §5.3.4).
     */
    private void playPendingBeeps(CardTerminal reader) throws InterruptedException {
        int[] durations;
        while ((durations = beeps.poll()) != null) {
            Card card = null;
            try {
                card = reader.connect("direct");
                for (int i = 0; i < durations.length; i++) {
                    byte units = (byte) Math.max(1, durations[i] / 10);
                    card.transmitControlCommand(BluetoothTerminalManager.IOCTL_ESCAPE,
                            new byte[]{(byte) 0xE0, 0x00, 0x00, 0x28, 0x01, units});
                    // Attendre la fin du bip : un nouvel ordre ne doit pas l'écourter.
                    Thread.sleep(durations[i] + BEEP_GAP_MS);
                }
            } catch (CardException e) {
                Log.w(TAG, "Bip impossible", e);
            } finally {
                if (card != null) {
                    try {
                        card.disconnect(false);
                    } catch (CardException e) {
                        Log.w(TAG, "Libération après bip impossible", e);
                    }
                }
            }
        }
    }

    private String readUid(CardTerminal reader) throws CardException {
        Card card = reader.connect("*");
        try {
            ResponseAPDU response = card.getBasicChannel().transmit(new CommandAPDU(GET_UID_APDU));
            if (response.getSW() != 0x9000) {
                emitStatus("read-error", String.format(Locale.ROOT,
                        "Carte détectée, UID illisible (SW %04X).", response.getSW()), reader.getName());
                return null;
            }
            return toHex(response.getData());
        } finally {
            card.disconnect(false);
        }
    }

    private void disconnectTerminal() {
        CardTerminal current = terminal;
        terminal = null;
        beeps.clear();
        if (current != null && manager != null) {
            try {
                manager.disconnect(current);
            } catch (RuntimeException e) {
                Log.w(TAG, "Déconnexion impossible", e);
            }
        }
    }

    private void stopScanQuietly() {
        if (manager == null) return;
        try {
            manager.stopScan();
        } catch (RuntimeException e) {
            Log.w(TAG, "Arrêt du scan impossible", e);
        }
    }

    private boolean hasBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return isGranted(Manifest.permission.BLUETOOTH_SCAN)
                    && isGranted(Manifest.permission.BLUETOOTH_CONNECT);
        }
        return isGranted(Manifest.permission.ACCESS_FINE_LOCATION);
    }

    private boolean isGranted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void emitStatus(String status, String message, String terminalName) {
        JSObject event = new JSObject();
        event.put("status", status);
        event.put("message", message);
        if (terminalName != null) {
            event.put("terminal", terminalName);
        }
        notifyListeners("status", event, true);
    }

    private static String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format(Locale.ROOT, "%02X", value));
        }
        return builder.toString();
    }
}
