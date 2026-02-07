import { Component, Input, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileService, S3_ROOT_FOLDERS } from '../../common/services/files.service';
import { firstValueFrom } from 'rxjs';
import * as pdfjsLib from 'pdfjs-dist';
import { TitleService } from '../../front/title/title.service';

// Configure PDF.js worker with local version (v4.x compatible)
if (typeof window !== 'undefined') {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

@Component({
    selector: 'app-comitee-booklet-viewer',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './comitee-booklet-viewer.component.html',
    styleUrls: ['./comitee-booklet-viewer.component.scss']
})
export class ComiteeBookletViewerComponent implements OnInit, AfterViewInit {
    @Input() pdfSrc!: string;
    @ViewChild('leftCanvas', { static: false }) leftCanvas?: ElementRef<HTMLCanvasElement>;
    @ViewChild('rightCanvas', { static: false }) rightCanvas?: ElementRef<HTMLCanvasElement>;
    @ViewChild('nextCanvas', { static: false }) nextCanvas?: ElementRef<HTMLCanvasElement>;
    @ViewChild('prevCanvas', { static: false }) prevCanvas?: ElementRef<HTMLCanvasElement>;
    @ViewChild('nextLeftCanvas', { static: false }) nextLeftCanvas?: ElementRef<HTMLCanvasElement>;
    
    pages: number[] = [];
    pagePairs: [number, number?][] = [];
    pdfError: string | null = null;
    presignedUrl: string | null = null;
    currentIndex: number = 0;
    isFlipping: boolean = false;
    flipDirection: 'left' | 'right' | null = null;
    displayIndex: number = 0;
    
    pdfDocument: any = null;
    private renderScale = 1.5;
    private renderTasks = new Map<HTMLCanvasElement, any>();

    constructor(
        private route: ActivatedRoute,
        private fileService: FileService,
        private titleService: TitleService,
    ) { }

    async ngOnInit(): Promise<void> {

        this.titleService.setTitle('Agenda compétitions Midi-Pyrénées ');
        this.pdfSrc = 'Tableau de Bord 2025-2026.pdf'; // Valeur par défaut
        if (!this.pdfSrc) {
            const dataSrc = this.route.snapshot.data['pdfSrc'];
            if (dataSrc) {
                this.pdfSrc = dataSrc;
                console.log('[PdfBookletViewer] pdfSrc from route:', this.pdfSrc);
            } else {
                console.warn('[PdfBookletViewer] pdfSrc not found in route data');
            }
        }

        let s3Key = this.pdfSrc;
        if (this.pdfSrc && !this.pdfSrc.startsWith(S3_ROOT_FOLDERS.DOCUMENTS + '/')) {
            s3Key = S3_ROOT_FOLDERS.DOCUMENTS + '/' + this.pdfSrc;
        }
        if (s3Key) {
            try {
                this.presignedUrl = await firstValueFrom(this.fileService.getPresignedUrl$(s3Key, true));
                await this.loadPdf();
            } catch (err) {
                this.pdfError = "Impossible de récupérer l'URL du PDF depuis S3.";
                console.error('[PdfBookletViewer] Erreur getPresignedUrl$:', err);
            }
        }
    }

    ngAfterViewInit(): void {
        if (this.pdfDocument) {
            setTimeout(() => this.renderCurrentPages(), 100);
        }
    }

    async loadPdf(): Promise<void> {
        if (!this.presignedUrl) return;
        
        try {
            const loadingTask = pdfjsLib.getDocument(this.presignedUrl);
            this.pdfDocument = await loadingTask.promise;
            const numPages = this.pdfDocument.numPages;
            
            this.pages = Array.from({ length: numPages }, (_, i) => i + 1);
            this.pagePairs = [];
            
            for (let i = 2; i <= this.pages.length; i += 2) {
                const pair: [number, number?] = [i];
                if (i + 1 <= this.pages.length) {
                    pair.push(i + 1);
                }
                this.pagePairs.push(pair);
            }
            
            this.pdfError = null;
            
            setTimeout(() => this.renderCurrentPages(), 100);
        } catch (error) {
            console.error('[PdfBookletViewer] Error loading PDF:', error);
            this.pdfError = 'Impossible de charger le PDF.';
        }
    }

    async renderCurrentPages(): Promise<void> {
        if (!this.pdfDocument) return;

        if (this.displayIndex === 0) {
            // Page 1 à gauche
            await this.renderPage(1, this.leftCanvas?.nativeElement);
            
            // Page vide à droite (fond blanc)
            if (this.rightCanvas?.nativeElement) {
                const canvas = this.rightCanvas.nativeElement;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Obtenir les dimensions de la page 1 pour uniformité
                    const page1 = await this.pdfDocument.getPage(1);
                    const viewport = page1.getViewport({ scale: this.renderScale });
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    
                    // Remplir avec du blanc
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            }
            
            // Pré-charger la page suivante (page 2) sur nextCanvas
            if (this.pagePairs.length > 0) {
                const nextPair = this.pagePairs[0];
                // On pré-charge la page de DROITE de la paire suivante (celle qui sera révélée)
                const pageToPreload = nextPair[1] || nextPair[0];
                await this.renderPage(pageToPreload, this.nextCanvas?.nativeElement);
            }
        } else {
            const pair = this.pagePairs[this.displayIndex - 1];
            if (pair) {
                await this.renderPage(pair[0], this.leftCanvas?.nativeElement);
                if (pair[1]) {
                    await this.renderPage(pair[1], this.rightCanvas?.nativeElement);
                } else {
                    if (this.rightCanvas?.nativeElement) {
                        const ctx = this.rightCanvas.nativeElement.getContext('2d');
                        if (ctx) {
                            ctx.clearRect(0, 0, this.rightCanvas.nativeElement.width, this.rightCanvas.nativeElement.height);
                        }
                    }
                }
            }
            
            // Pré-charger la page suivante sur nextCanvas
            if (this.displayIndex < this.pagePairs.length) {
                const nextPair = this.pagePairs[this.displayIndex];
                if (nextPair) {
                    // On pré-charge la page de DROITE de la paire suivante (celle qui sera révélée)
                    const pageToPreload = nextPair[1] || nextPair[0];
                    await this.renderPage(pageToPreload, this.nextCanvas?.nativeElement);
                }
            }
        }
    }

    async renderPage(pageNum: number, canvas: HTMLCanvasElement | undefined): Promise<void> {
        if (!canvas || !this.pdfDocument) return;

        // Annuler le rendu en cours sur ce canvas s'il existe
        const existingTask = this.renderTasks.get(canvas);
        if (existingTask) {
            try {
                await existingTask.cancel();
            } catch (e) {
                // Ignorer les erreurs d'annulation
            }
            this.renderTasks.delete(canvas);
        }

        try {
            const page = await this.pdfDocument.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.renderScale });
            
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            const renderTask = page.render(renderContext);
            this.renderTasks.set(canvas, renderTask);
            
            await renderTask.promise;
            
            this.renderTasks.delete(canvas);
        } catch (error: any) {
            this.renderTasks.delete(canvas);
            // Ignorer les erreurs d'annulation (RenderingCancelledException)
            if (error?.name !== 'RenderingCancelledException') {
                console.error('[PdfBookletViewer] Error rendering page', pageNum, error);
            }
        }
    }

    getCurrentPageLabel(): string {
        if (this.displayIndex === 0) {
            return 'Page 1';
        }
        const pair = this.pagePairs[this.displayIndex - 1];
        if (!pair) return 'Page 1';
        return pair[1] ? `Pages ${pair[0]}-${pair[1]}` : `Page ${pair[0]}`;
    }

    async prevPage(): Promise<void> {
        if (this.currentIndex > 0 && !this.isFlipping) {
            const prevDisplayIndex = this.displayIndex - 1;
            
            // Pré-charger les pages de la paire précédente
            if (prevDisplayIndex === 0) {
                // Retour à la page 1
                if (this.prevCanvas?.nativeElement && this.pdfDocument) {
                    const canvas = this.prevCanvas.nativeElement;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        const page1 = await this.pdfDocument.getPage(1);
                        const viewport = page1.getViewport({ scale: this.renderScale });
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }
                }
                // Page de gauche = page 1
                await this.renderPage(1, this.nextLeftCanvas?.nativeElement);
            } else {
                const prevPair = this.pagePairs[prevDisplayIndex - 1];
                if (prevPair) {
                    // Page de DROITE (qui revient)
                    const pageToPreload = prevPair[1] || prevPair[0];
                    await this.renderPage(pageToPreload, this.prevCanvas?.nativeElement);
                    
                    // Page de GAUCHE
                    await this.renderPage(prevPair[0], this.nextLeftCanvas?.nativeElement);
                }
            }
            
            // Lancer l'animation
            this.isFlipping = true;
            this.flipDirection = 'left';
            
            // À mi-parcours, swapper la page de gauche
            setTimeout(() => {
                if (this.leftCanvas?.nativeElement && this.nextLeftCanvas?.nativeElement) {
                    const leftCtx = this.leftCanvas.nativeElement.getContext('2d');
                    if (leftCtx) {
                        this.leftCanvas.nativeElement.width = this.nextLeftCanvas.nativeElement.width;
                        this.leftCanvas.nativeElement.height = this.nextLeftCanvas.nativeElement.height;
                        leftCtx.drawImage(this.nextLeftCanvas.nativeElement, 0, 0);
                    }
                }
            }, 700);
            
            // Copier rightCanvas juste AVANT la fin de l'animation
            setTimeout(async () => {
                // D'ABORD copier prevCanvas vers rightCanvas
                if (this.rightCanvas?.nativeElement && this.prevCanvas?.nativeElement) {
                    const rightCtx = this.rightCanvas.nativeElement.getContext('2d');
                    if (rightCtx) {
                        this.rightCanvas.nativeElement.width = this.prevCanvas.nativeElement.width;
                        this.rightCanvas.nativeElement.height = this.prevCanvas.nativeElement.height;
                        rightCtx.drawImage(this.prevCanvas.nativeElement, 0, 0);
                    }
                }
            }, 1350);
            
            // Arrêter l'animation, mettre à jour les indices et pré-charger APRÈS
            setTimeout(async () => {
                // Mettre à jour les indices ET arrêter l'animation en même temps
                this.displayIndex--;
                this.currentIndex--;
                this.isFlipping = false;
                this.flipDirection = null;
                
                // MAINTENANT pré-charger pour la prochaine navigation (l'animation est terminée)
                if (this.currentIndex > 0) {
                    const prevPrevDisplayIndex = this.displayIndex - 1;
                    if (prevPrevDisplayIndex === 0) {
                        // Page vide
                        if (this.prevCanvas?.nativeElement && this.pdfDocument) {
                            const canvas = this.prevCanvas.nativeElement;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                const page1 = await this.pdfDocument.getPage(1);
                                const viewport = page1.getViewport({ scale: this.renderScale });
                                canvas.width = viewport.width;
                                canvas.height = viewport.height;
                                ctx.fillStyle = '#ffffff';
                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                            }
                        }
                    } else if (prevPrevDisplayIndex > 0) {
                        const prevPrevPair = this.pagePairs[prevPrevDisplayIndex - 1];
                        if (prevPrevPair) {
                            const pageToPreload = prevPrevPair[1] || prevPrevPair[0];
                            await this.renderPage(pageToPreload, this.prevCanvas?.nativeElement);
                        }
                    }
                }
            }, 1400);
        }
    }

    async nextPage(): Promise<void> {
        if (this.currentIndex < this.pagePairs.length && !this.isFlipping) {
            const nextDisplayIndex = this.displayIndex + 1;
            
            // Pré-charger les pages de la paire suivante
            if (nextDisplayIndex > 0 && nextDisplayIndex <= this.pagePairs.length) {
                const nextPair = this.pagePairs[nextDisplayIndex - 1];
                if (nextPair) {
                    // Page de DROITE (révélée pendant l'animation)
                    const rightPageToPreload = nextPair[1] || nextPair[0];
                    await this.renderPage(rightPageToPreload, this.nextCanvas?.nativeElement);
                    
                    // Page de GAUCHE (qui apparaîtra à la fin)
                    await this.renderPage(nextPair[0], this.nextLeftCanvas?.nativeElement);
                }
            }
            
            // Lancer l'animation
            this.isFlipping = true;
            this.flipDirection = 'right';
            
            // À mi-parcours de l'animation, swapper la page de gauche en douceur
            setTimeout(() => {
                if (this.leftCanvas?.nativeElement && this.nextLeftCanvas?.nativeElement) {
                    const leftCtx = this.leftCanvas.nativeElement.getContext('2d');
                    const nextLeftCtx = this.nextLeftCanvas.nativeElement.getContext('2d');
                    if (leftCtx && nextLeftCtx) {
                        // Copier nextLeftCanvas vers leftCanvas
                        this.leftCanvas.nativeElement.width = this.nextLeftCanvas.nativeElement.width;
                        this.leftCanvas.nativeElement.height = this.nextLeftCanvas.nativeElement.height;
                        leftCtx.drawImage(this.nextLeftCanvas.nativeElement, 0, 0);
                    }
                }
            }, 700); // À mi-parcours de l'animation
            
            // Copier rightCanvas juste AVANT la fin de l'animation
            setTimeout(async () => {
                // D'ABORD copier nextCanvas vers rightCanvas
                if (this.rightCanvas?.nativeElement && this.nextCanvas?.nativeElement) {
                    const rightCtx = this.rightCanvas.nativeElement.getContext('2d');
                    if (rightCtx) {
                        this.rightCanvas.nativeElement.width = this.nextCanvas.nativeElement.width;
                        this.rightCanvas.nativeElement.height = this.nextCanvas.nativeElement.height;
                        rightCtx.drawImage(this.nextCanvas.nativeElement, 0, 0);
                    }
                }
            }, 1350);
            
            // Arrêter l'animation, mettre à jour les indices et pré-charger APRÈS
            setTimeout(async () => {
                // Mettre à jour les indices ET arrêter l'animation en même temps
                this.displayIndex++;
                this.currentIndex++;
                this.isFlipping = false;
                this.flipDirection = null;
                
                // MAINTENANT pré-charger pour la prochaine navigation (l'animation est terminée)
                if (this.displayIndex < this.pagePairs.length) {
                    const nextNextPair = this.pagePairs[this.displayIndex];
                    if (nextNextPair) {
                        const pageToPreload = nextNextPair[1] || nextNextPair[0];
                        await this.renderPage(pageToPreload, this.nextCanvas?.nativeElement);
                    }
                }
            }, 1400);
        }
    }

    get isFirst(): boolean {
        return this.currentIndex === 0;
    }

    get isLast(): boolean {
        return this.currentIndex === this.pagePairs.length;
    }

    get showRightPage(): boolean {
        return true; // Afficher toujours la page de droite (vide pour la page 1)
    }

    private goToPageTimeout: any = null;

    async goToPage(newIndex: number): Promise<void> {
        if (this.isFlipping || newIndex < 0 || newIndex > this.pagePairs.length || newIndex === this.currentIndex) {
            return;
        }

        // Débouncer les changements rapides (throttle de 50ms)
        if (this.goToPageTimeout) {
            clearTimeout(this.goToPageTimeout);
        }

        this.goToPageTimeout = setTimeout(async () => {
            // Navigation directe sans animation
            this.displayIndex = newIndex;
            this.currentIndex = newIndex;
            await this.renderCurrentPages();
        }, 50);
    }
}
