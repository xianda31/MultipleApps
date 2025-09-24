import { NgModule } from '@angular/core';
import { CapitalizeFirstPipe } from './pipes/capitalize_first';
import { MoveToEndPipe } from './pipes/move-to-end.pipe';
import { ParenthesisPipe } from './pipes/parenthesis.pipe';
import { PhonePipe } from './pipes/phone.pipe';
import { ReplacePipe } from './pipes/replace.pipe';
import { RmbracketsPipe } from './pipes/rmbrackets.pipe';
import { threedigitsPipe } from './pipes/three_digits.pipe';
import { HeadPipe } from './pipes/trail.pipe';
import { TruncatePipe } from './pipes/truncate.pipe';
import { TrailPipe } from './pipes/head.pipe';

@NgModule({
  imports: [
    CapitalizeFirstPipe,
    MoveToEndPipe,
    ParenthesisPipe,
    PhonePipe,
    ReplacePipe,
    RmbracketsPipe,
    threedigitsPipe,
    HeadPipe,
    TruncatePipe,
    TrailPipe
  ],
  exports: [
    CapitalizeFirstPipe,
    MoveToEndPipe,
    ParenthesisPipe,
    PhonePipe,
    ReplacePipe,
    RmbracketsPipe,
    threedigitsPipe,
    HeadPipe,
    TruncatePipe,
    TrailPipe
  ]
})
export class SharedModule {}
