export const FEEDBACK_MAX_LENGTH = 500;

export function feedbackValidationError(comment: string): string | null {
    if (!comment.trim()) return 'Напишіть відгук перед надсиланням.';
    if (comment.length > FEEDBACK_MAX_LENGTH) return `Відгук має містити не більше ${FEEDBACK_MAX_LENGTH} символів.`;
    return null;
}
