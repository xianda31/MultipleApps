import { Injectable } from '@angular/core';
import { DBhandler } from './graphQL.service';
import { AssistanceRequest, AssistanceRequestInput } from '../interfaces/assistance-request.interface';
import { Observable } from 'rxjs';


@Injectable({ providedIn: 'root' })
export class AssistanceRequestService {
  constructor(private db: DBhandler) {}

  async createRequest(input: AssistanceRequestInput): Promise<any> {
    // Appelle la mutation GraphQL (voir resource backend)
    return this.db.createAssistanceRequest(input);
  }

  async updateRequest(request: AssistanceRequest): Promise<any> {
    return this.db.updateAssistanceRequest(request);
  }

   getAllRequests(): Observable<AssistanceRequest[]> {
    return this.db.listAssistanceRequests();
  }
}
