import { of } from 'rxjs';

import { FileService } from '../../common/services/files.service';
import { ImgService } from '../../common/services/img.service';
import { ToastService } from '../../common/services/toast.service';
import { MaintenanceImagesComponent } from './maintenance-images.component';

describe('MaintenanceImagesComponent', () => {
  let component: MaintenanceImagesComponent;
  let fileService: jasmine.SpyObj<FileService>;
  let imgService: jasmine.SpyObj<ImgService>;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    fileService = jasmine.createSpyObj<FileService>('FileService', [
      'list_files',
      'getPresignedUrl$',
      'upload_file',
      'delete_file',
    ]);
    imgService = jasmine.createSpyObj<ImgService>('ImgService', ['imageDimensions']);
    toastService = jasmine.createSpyObj<ToastService>('ToastService', [
      'showSuccess',
      'showWarning',
      'showError',
    ]);
    fileService.list_files.and.returnValue(of([]));
    component = new MaintenanceImagesComponent(fileService, imgService, toastService);
  });

  it('lists only direct images from the homepage folder', async () => {
    fileService.list_files.and.returnValue(of([
      { path: 'images/_ACCUEIL_/hero.jpg', size: 2048, url$: of('hero-url') },
      { path: 'images/_ACCUEIL_/nested/other.png', size: 1024, url$: of('nested-url') },
      { path: 'images/_ACCUEIL_/notes.txt', size: 64, url$: of('notes-url') },
      { path: 'images/_ACCUEIL_/empty/', size: 0 },
    ]));

    await component.refresh();

    expect(fileService.list_files).toHaveBeenCalledWith('images/_ACCUEIL_/');
    expect(component.images.map(image => image.name)).toEqual(['hero.jpg']);
    expect(component.images[0].previewUrl).toBe('hero-url');
  });

  it('uploads immutable sources and waits for Sharp variants after confirmation', async () => {
    fileService.upload_file.and.resolveTo();
    fileService.getPresignedUrl$.and.returnValue(of('variant-url'));
    imgService.imageDimensions.and.resolveTo({ width: 1600, height: 900 });
    spyOn(globalThis.crypto, 'randomUUID').and.returnValues(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    );
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [
        new File(['first'], 'first.jpg', { type: 'image/jpeg' }),
        new File(['second'], 'second.webp', { type: 'image/webp' }),
      ],
    });

    await component.onFilesSelected({ target: input } as unknown as Event);

    expect(fileService.upload_file).not.toHaveBeenCalled();
    expect(component.preparedImages.map(image => image.source.name)).toEqual([
      '11111111-1111-4111-8111-111111111111.jpg',
      '22222222-2222-4222-8222-222222222222.webp',
    ]);

    await component.uploadPreparedImages();

    expect(fileService.upload_file).toHaveBeenCalledTimes(2);
    expect(fileService.upload_file.calls.allArgs().map(args => args[1]))
      .toEqual(['images/home/sources/', 'images/home/sources/']);
    expect(fileService.getPresignedUrl$.calls.allArgs()).toEqual([
      ['images/_ACCUEIL_/11111111-1111-4111-8111-111111111111.webp', true, true],
      ['images/_ACCUEIL_/22222222-2222-4222-8222-222222222222.webp', true, true],
    ]);
    expect(toastService.showSuccess).toHaveBeenCalled();
  });

  it('removes a confirmed image from the displayed gallery', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    fileService.delete_file.and.resolveTo();
    const image = {
      path: 'images/_ACCUEIL_/hero.jpg',
      name: 'hero.jpg',
      size: 2048,
      previewUrl: 'hero-url',
    };
    component.images = [image];

    await component.deleteImage(image);

    expect(fileService.delete_file).toHaveBeenCalledWith(image.path);
    expect(component.images).toEqual([]);
    expect(toastService.showSuccess).toHaveBeenCalled();
  });
});