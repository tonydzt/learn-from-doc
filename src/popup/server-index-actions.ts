import React from 'react';
import { t } from '../i18n/messages';
import type { LanguageCode } from '../settings/app-settings';
import { accountLoginStatus, type AccountLoginStatus, type AccountSession } from '../settings/account-session';
import type { ServerIndexAvailabilityMessage } from '../shared/messages';

export type ServerIndexActionsProps = {
  canPull: boolean;
  canPullReview: boolean;
  canUpload: boolean;
  indexed: boolean;
  language: LanguageCode;
  serverBusy: boolean;
  serverIndex?: ServerIndexAvailabilityMessage;
  serverError: string | null;
  onPull(): void;
  onPullReview(): void;
  onUpload(): void;
};

export type ServerAccountCapabilities = {
  accountStatus: AccountLoginStatus;
  canPull: boolean;
  canPullReview: boolean;
  canUpload: boolean;
};

export function serverAccountCapabilities(
  accountSession: AccountSession | null,
  now = Date.now(),
): ServerAccountCapabilities {
  const accountStatus = accountLoginStatus(accountSession, now);
  const canPull = accountSession?.permissions.canPullServerData === true;
  return {
    accountStatus,
    canPull,
    canPullReview: canPull && accountSession?.permissions.canTestSystemIndexes === true,
    canUpload: accountSession?.permissions.canSync === true,
  };
}

export function ServerIndexActions(props: ServerIndexActionsProps) {
  const hasNormalServerIndex = props.serverIndex?.kinds.some((kind) => kind === 'system' || kind === 'user_upload') === true;
  const hasReviewServerIndex = props.serverIndex?.kinds.includes('pending_review') === true;
  const showPull = props.canPull && !props.indexed && props.serverIndex?.available === true && hasNormalServerIndex;
  const showReviewPull = props.canPullReview && !props.indexed && props.serverIndex?.available === true && hasReviewServerIndex;
  const showUpload = props.canUpload && props.indexed;
  if (!showPull && !showReviewPull && !showUpload && !props.serverError) return null;

  return React.createElement(
    'section',
    { className: 'server-index-actions' },
    showPull
      ? React.createElement(
        'p',
        { className: 'server-index-hint' },
        t(props.language, 'popup.serverIndexAvailable', {
          count: props.serverIndex?.site?.pageCount ?? props.serverIndex?.pageCount ?? 0,
        }),
      )
      : null,
    React.createElement(
      'div',
      { className: 'server-index-buttons' },
      showReviewPull
        ? React.createElement(
          'button',
          {
            className: 'secondary',
            disabled: props.serverBusy,
            type: 'button',
            onClick: props.onPullReview,
          },
          props.serverBusy ? t(props.language, 'popup.pullingReviewFromServer') : t(props.language, 'popup.pullReviewFromServer'),
        )
        : null,
      showPull
        ? React.createElement(
          'button',
          {
            className: 'secondary',
            disabled: props.serverBusy,
            type: 'button',
            onClick: props.onPull,
          },
          props.serverBusy ? t(props.language, 'popup.pullingFromServer') : t(props.language, 'popup.pullFromServer'),
        )
        : null,
      showUpload
        ? React.createElement(
          'button',
          {
            className: 'secondary',
            disabled: props.serverBusy,
            type: 'button',
            onClick: props.onUpload,
          },
          props.serverBusy ? t(props.language, 'popup.uploadingToServer') : t(props.language, 'popup.uploadToServer'),
        )
        : null,
    ),
    props.serverError
      ? React.createElement('p', { className: 'server-index-error' }, props.serverError)
      : null,
  );
}
