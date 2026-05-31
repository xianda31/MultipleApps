import { Injectable } from '@angular/core';
import outputs from '../../../../../../amplify_outputs.json';

const API_BASE = (outputs as any).custom?.API?.ffbProxyApi?.endpoint?.replace(/\/$/, '') ?? '';

export interface SurveyRespondData {
  token: string;
  memberId: string;
  memberName: string;
  survey: {
    id: string;
    title: string;
    description?: string;
    surveyType: 'poll' | 'rsvp' | 'invitation';
    status?: 'draft' | 'active' | 'closed';
    closingDate?: string;
    footerNote?: string;
  };
  questions: Array<{ id: string; text: string; options: string[]; order: number }>;
  existingResponse: {
    id: string;
    answers: Record<string, number>;
    status: string;
    submittedAt: string;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class SurveyRespondService {

  async load(token: string): Promise<SurveyRespondData> {
    const res = await fetch(`${API_BASE}/api/survey/respond?token=${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json as SurveyRespondData;
  }

  async submit(token: string, answers: Record<string, number>): Promise<void> {
    const res = await fetch(`${API_BASE}/api/survey/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, answers }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  }

  async updateStatus(token: string, status: 'confirmed' | 'declined' | 'cancelled' | 'submitted'): Promise<void> {
    const res = await fetch(`${API_BASE}/api/survey/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  }
}
