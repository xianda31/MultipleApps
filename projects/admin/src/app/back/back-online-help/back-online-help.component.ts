import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HELP_CONTENT_VERSION, HELP_TOPICS, HelpTopic } from './back-online-help-content';
import { Group_names, Group_priorities } from '../../common/authentification/group.interface';
import { GroupService } from '../../common/authentification/group.service';

type GroupItem = {
  label: string;
  value: Group_names;
};

@Component({
  selector: 'app-back-online-help',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './back-online-help.component.html',
  styleUrl: './back-online-help.component.scss'
})
export class BackOnlineHelpComponent implements OnInit {
  readonly contentVersion = HELP_CONTENT_VERSION;
  readonly topics = HELP_TOPICS;
  readonly contentSourceFile = 'projects/admin/src/app/back/back-online-help/back-online-help-content.ts';
  private readonly defaultTopicId = 'documentation';
  private currentUserGroup: Group_names | null = null;
  readonly orderedGroups: GroupItem[] = [
    { label: Group_names.Member, value: Group_names.Member },
    { label: Group_names.Support, value: Group_names.Support },
    { label: Group_names.Editor, value: Group_names.Editor },
    { label: Group_names.Admin, value: Group_names.Admin },
    { label: Group_names.System, value: Group_names.System },
  ];

  selectedMenuTopic: HelpTopic = this.findTopicById(this.defaultTopicId) ?? this.topics[0];
  selectedDetailTopic: HelpTopic = this.selectedMenuTopic;

  constructor(private groupService: GroupService) {}

  async ngOnInit(): Promise<void> {
    const groups = await this.groupService.getCurrentUserGroups();
    this.currentUserGroup = groups.length > 0 ? groups[0] : null;
  }

  get selectedTopic(): HelpTopic {
    return this.selectedDetailTopic;
  }

  isGroupChecked(group: Group_names): boolean {
    const requiredGroup = this.selectedDetailTopic.nav.groupLevel as Group_names;
    return Group_priorities[group] >= Group_priorities[requiredGroup];
  }

  canAccessTopic(topic: HelpTopic): boolean {
    if (!this.currentUserGroup) return false;
    const requiredGroup = topic.nav.groupLevel as Group_names;
    return Group_priorities[this.currentUserGroup] >= Group_priorities[requiredGroup];
  }

  hasSubTopics(): boolean {
    return !!this.selectedMenuTopic.children?.length;
  }

  selectTopic(topic: HelpTopic): void {
    this.selectedMenuTopic = topic;
    this.selectedDetailTopic = topic;
  }

  selectSubTopic(topic: HelpTopic): void {
    this.selectedDetailTopic = topic;
  }

  private findTopicById(topicId: string): HelpTopic | undefined {
    const parent = this.topics.find((topic) => topic.id === topicId);
    if (parent) {
      return parent;
    }

    for (const topic of this.topics) {
      const child = topic.children?.find((candidate) => candidate.id === topicId);
      if (child) {
        return child;
      }
    }

    return undefined;
  }
}