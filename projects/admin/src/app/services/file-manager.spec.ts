import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FileService } from '../common/services/files.service';
import { FileManager } from './file-manager';

describe('FileManager', () => {
  let service: FileManager;
  let fileService: jasmine.SpyObj<FileService>;

  beforeEach(() => {
    fileService = jasmine.createSpyObj<FileService>('FileService', [
      'generate_filesystem',
      'list_files',
      'upload_file'
    ]);
    fileService.list_files.and.returnValue(of([]));
    fileService.generate_filesystem.and.returnValue({});

    TestBed.configureTestingModule({
      providers: [{ provide: FileService, useValue: fileService }]
    });
    service = TestBed.inject(FileManager);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('rejects when FileService.upload_file rejects', async () => {
    const uploadError = new Error('Upload failed');
    const file = new File(['contents'], 'example.txt');
    fileService.upload_file.and.returnValue(Promise.reject(uploadError));
    service.addFilesToUpload('documents/', [file]);

    await expectAsync(service.uploadFiles('documents/')).toBeRejectedWithError('example.txt: Upload failed');
  });
});
