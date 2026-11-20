import helpContentDocument from '../../../assets/documentation/back-online-help.json';
import { BACK_ROUTE_ABS_PATHS, BACK_ROUTE_PATHS } from '../routes/back-route-paths';

export type HelpNavMeta = {
  menuTitle?: string;
  subMenuTitle?: string;
  icon: string;
  groupLevel: 'Membre' | 'Contributeur' | 'Editeur' | 'Administrateur' | 'Systeme';
  adminOnly?: boolean;
};

export type HelpIllustration = {
  id: string;
  path: string;
  alt: string;
  caption?: string;
  source?: string;
};

export type HelpBlockType =
  | 'text'
  | 'list'
  | 'procedure'
  | 'illustration'
  | 'table'
  | 'attention';

export type HelpContentBlock = {
  id: string;
  type: HelpBlockType;
  title?: string;
  paragraphs?: string[];
  items?: string[];
  steps?: string[];
  illustrationId?: string;
  illustration?: HelpIllustration;
  caption?: string;
  columns?: string[];
  rows?: string[][];
  messages?: string[];
};

export type HelpTopic = {
  id: string;
  title: string;
  summary: string;
  scope?: 'application' | 'general';
  contentStatus?: 'published' | 'planned';
  manualChapterOrder?: number;
  route?: string;
  nav: HelpNavMeta;
  blocks: HelpContentBlock[];
  illustrations?: HelpIllustration[];
  children?: HelpTopic[];
};

type BackRouteKey = keyof typeof BACK_ROUTE_PATHS;
type HelpRouteKey = BackRouteKey | 'FrontHome';
type HelpTopicDocument = Omit<HelpTopic, 'route' | 'blocks' | 'children'> & {
  routeKey?: HelpRouteKey;
  blocks: Omit<HelpContentBlock, 'illustration'>[];
  children?: HelpTopicDocument[];
};
type HelpContentDocument = {
  version: string;
  topics: HelpTopicDocument[];
};

const HELP_ROUTES: Record<HelpRouteKey, string> = {
  ...(BACK_ROUTE_ABS_PATHS as Record<BackRouteKey, string>),
  FrontHome: '/front',
};
const HELP_CONTENT = helpContentDocument as HelpContentDocument;

function resolveTopic(topic: HelpTopicDocument): HelpTopic {
  const { routeKey, children, ...content } = topic;
  const illustrationById = new Map(
    (content.illustrations ?? []).map((illustration) => [illustration.id, illustration]),
  );

  return {
    ...content,
    scope: content.scope ?? 'application',
    contentStatus: content.contentStatus ?? 'published',
    route: routeKey ? HELP_ROUTES[routeKey] : undefined,
    blocks: content.blocks.map((block) => {
      if (block.type !== 'illustration') return block;
      const illustration = block.illustrationId
        ? illustrationById.get(block.illustrationId)
        : undefined;
      if (!illustration) {
        throw new Error(
          `Illustration ${block.illustrationId ?? '(sans identifiant)'} introuvable pour ${topic.id}`,
        );
      }
      return { ...block, illustration };
    }),
    children: children?.map(resolveTopic),
  };
}

export const HELP_CONTENT_VERSION = HELP_CONTENT.version;
export const HELP_TOPICS: HelpTopic[] = HELP_CONTENT.topics.map(resolveTopic);
