import { t } from '../../../src/i18n/messages';
import type { LanguageCode } from '../../../src/settings/app-settings';

export function fmtPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function fmtDate(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

export function fmtHeight(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k px`;
  return `${Math.round(value)} px`;
}

export function boolLabel(language: LanguageCode, value: boolean): string {
  return value ? t(language, 'common.on') : t(language, 'common.off');
}
