import type { BackgroundHandler } from '../../types';
import {
  getAccountSessionForBackground,
  loginAccountForBackground,
  logoutAccountForBackground,
  refreshAccountPermissionsForBackground,
} from '../../services/account';

export const handleAccountMessages: BackgroundHandler = (message) => {
  if (message.type === 'GET_ACCOUNT_SESSION') return getAccountSessionForBackground();

  if (message.type === 'LOGIN_ACCOUNT') return loginAccountForBackground(message.email, message.password);

  if (message.type === 'LOGOUT_ACCOUNT') return logoutAccountForBackground();

  if (message.type === 'REFRESH_ACCOUNT_PERMISSIONS') return refreshAccountPermissionsForBackground();

  return undefined;
};
