import type { ArchitecturalEvent } from '@archlens/shared/types';
import { ArchitecturalEventType } from '@archlens/shared/types';

// ---------------------------------------------------------------------------
// toSentence — maps an ArchitecturalEvent to a terse technical sentence
//
// Pure function: takes a nodeNameFn for display name resolution so this
// function remains testable without graphStore coupling.
// ---------------------------------------------------------------------------

/**
 * Converts an ArchitecturalEvent into a terse technical natural-language sentence.
 *
 * @param event      The architectural event to describe
 * @param nodeNameFn Resolves a node ID to its display name (e.g. from graphStore)
 */
export function toSentence(
  event: ArchitecturalEvent,
  nodeNameFn: (id: string) => string,
): string {
  const name = nodeNameFn(event.nodeId);
  const targetName = event.targetNodeId ? nodeNameFn(event.targetNodeId) : '';

  switch (event.type) {
    case ArchitecturalEventType.COMPONENT_CREATED:
      return `${name} created`;

    case ArchitecturalEventType.COMPONENT_SPLIT:
      return `${name} split`;

    case ArchitecturalEventType.COMPONENT_MERGED:
      return `${name} merged`;

    case ArchitecturalEventType.DEPENDENCY_ADDED:
      return `${name} → depends on ${targetName}`;

    case ArchitecturalEventType.DEPENDENCY_REMOVED:
      return `${name} → removed dep on ${targetName}`;

    default:
      return `${name} updated`;
  }
}
