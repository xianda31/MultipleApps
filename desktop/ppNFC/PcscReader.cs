using System;
using System.IO;
using System.Runtime.InteropServices;

// Also compiled by Windows PowerShell Add-Type; keep this file compatible with its C# compiler.
namespace NfcDiagnostic
{
    public interface IPcscReader : IDisposable
    {
        string[] ListReaders();
        bool IsCardPresent(string reader);
        string ReadUid(string reader);
    }

    public sealed class PcscException : InvalidOperationException
    {
        public uint Code { get; private set; }

        public PcscException(uint code, string operation)
            : base(operation + ": PC/SC error 0x" + code.ToString("X8"))
        {
            Code = code;
        }
    }

    public sealed class PresenceReader : IPcscReader
    {
        private IntPtr context;

        [StructLayout(LayoutKind.Sequential)]
        private struct IoRequest
        {
            public uint Protocol;
            public uint Length;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct ReaderState
        {
            public string Reader;
            public IntPtr UserData;
            public uint CurrentState;
            public uint EventState;
            public uint AtrLength;
            [MarshalAs(UnmanagedType.ByValArray, SizeConst = 36)]
            public byte[] Atr;
        }

        [DllImport("winscard.dll")]
        private static extern uint SCardEstablishContext(uint scope, IntPtr reserved1, IntPtr reserved2, out IntPtr context);
        [DllImport("winscard.dll")]
        private static extern uint SCardReleaseContext(IntPtr context);
        [DllImport("winscard.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
        private static extern uint SCardListReadersW(IntPtr context, string groups, [Out] char[] readers, ref uint length);
        [DllImport("winscard.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
        private static extern uint SCardGetStatusChangeW(IntPtr context, uint timeout, [In, Out] ReaderState[] states, uint count);
        [DllImport("winscard.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
        private static extern uint SCardConnectW(IntPtr context, string reader, uint share, uint protocols, out IntPtr card, out uint protocol);
        [DllImport("winscard.dll")]
        private static extern uint SCardDisconnect(IntPtr card, uint disposition);
        [DllImport("winscard.dll")]
        private static extern uint SCardTransmit(IntPtr card, ref IoRequest sendPci, byte[] command, uint commandLength, IntPtr receivePci, [Out] byte[] response, ref uint responseLength);
        [DllImport("winscard.dll")]
        private static extern uint SCardControl(IntPtr card, uint controlCode, byte[] command, uint commandLength, [Out] byte[] response, uint responseLength, out uint received);

        private static void Check(uint result, string operation)
        {
            if (result != 0)
                throw new PcscException(result, operation);
        }

        public PresenceReader()
        {
            Check(SCardEstablishContext(0, IntPtr.Zero, IntPtr.Zero, out context), "Establish context");
        }

        public string[] ListReaders()
        {
            uint length = 0;
            uint result = SCardListReadersW(context, null, null, ref length);
            if (result == 0x8010002E)
                return new string[0];
            Check(result, "List readers");
            char[] readers = new char[length];
            Check(SCardListReadersW(context, null, readers, ref length), "List readers");
            return new string(readers).Split(new char[] { '\0' }, StringSplitOptions.RemoveEmptyEntries);
        }

        public bool IsCardPresent(string reader)
        {
            ReaderState[] states = new ReaderState[] {
                new ReaderState { Reader = reader, Atr = new byte[36] }
            };
            Check(SCardGetStatusChangeW(context, 0, states, 1), "Check card presence");
            uint state = states[0].EventState;
            if ((state & 0x000D) != 0)
                throw new PcscException(0x80100017, "Reader unavailable: " + reader);
            return (state & 0x0020) != 0;
        }

        private bool IsCardRemoval(uint result, string reader)
        {
            return result == 0x8010000C || result == 0x80100069 ||
                (result == 0x00000458 && !IsCardPresent(reader));
        }

        public void Beep(string reader)
        {
            IntPtr card;
            uint protocol;
            Check(SCardConnectW(context, reader, 3, 0, out card, out protocol), "Connect to reader for buzzer");
            try
            {
                byte[] command = new byte[] { 0xE0, 0, 0, 0x28, 1, 0x14 };
                byte[] response = new byte[258];
                uint received;
                Check(SCardControl(card, 0x003136B0, command, (uint)command.Length, response, (uint)response.Length, out received), "Buzzer control");
                if (received != 6 || response[0] != 0xE1 || response[1] != 0 ||
                    response[2] != 0 || response[3] != 0 || response[4] != 1 || response[5] != 0x14)
                    throw new InvalidDataException("Unexpected buzzer response: " + BitConverter.ToString(response, 0, (int)received));
            }
            finally
            {
                Check(SCardDisconnect(card, 0), "Disconnect from reader");
            }
        }

        public static string DecodeUid(byte[] response, int length)
        {
            if (response == null || length < 2 || length > response.Length)
                throw new InvalidDataException("Read UID: invalid response length.");
            if (response[length - 2] != 0x90 || response[length - 1] != 0)
                throw new InvalidDataException("Read UID: card status " + response[length - 2].ToString("X2") + response[length - 1].ToString("X2"));
            int uidLength = length - 2;
            if (uidLength != 4 && uidLength != 7 && uidLength != 10)
                throw new InvalidDataException("Unexpected ISO 14443-A UID length: " + uidLength);
            return BitConverter.ToString(response, 0, uidLength).Replace("-", "");
        }

        public string ReadUid(string reader)
        {
            IntPtr card;
            uint protocol;
            uint result = SCardConnectW(context, reader, 2, 3, out card, out protocol);
            if (IsCardRemoval(result, reader))
                return null;
            Check(result, "Connect to card");
            string uid = null;
            try
            {
                IoRequest pci = new IoRequest { Protocol = protocol, Length = (uint)Marshal.SizeOf(typeof(IoRequest)) };
                byte[] command = new byte[] { 0xFF, 0xCA, 0, 0, 0 };
                byte[] response = new byte[258];
                uint length = (uint)response.Length;
                result = SCardTransmit(card, ref pci, command, (uint)command.Length, IntPtr.Zero, response, ref length);
                if (!IsCardRemoval(result, reader))
                {
                    Check(result, "Read UID");
                    uid = DecodeUid(response, (int)length);
                }
            }
            finally
            {
                uint disconnectResult = SCardDisconnect(card, 0);
                if (!IsCardRemoval(disconnectResult, reader))
                    Check(disconnectResult, "Disconnect from card");
            }
            return uid;
        }

        public void Dispose()
        {
            if (context != IntPtr.Zero)
            {
                uint result = SCardReleaseContext(context);
                context = IntPtr.Zero;
                Check(result, "Release context");
            }
        }
    }
}
