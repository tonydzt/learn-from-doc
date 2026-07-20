import React from 'react';
import {
  accountLoginStatus,
  type AccountSession,
} from '../../../../src/settings/account-session';

type AccountPageProps = {
  accountBusy: boolean;
  accountError: string | null;
  accountSession: AccountSession | null;
  now?: number;
  loginAccount(email: string, password: string): void;
  logoutAccount(): void;
  refreshAccountPermissions(): void;
};

function formatExpiresAt(expiresAt: number): string {
  const date = new Date(expiresAt);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

export function AccountPage(props: AccountPageProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const session = props.accountSession;
  const status = accountLoginStatus(session, props.now);

  const loginForm = (
    <form className="account-form" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      props.loginAccount(String(form.get('email') ?? ''), String(form.get('password') ?? ''));
    }}>
      <label>
        <span>Email</span>
        <input
          autoComplete="email"
          disabled={props.accountBusy}
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
      </label>
      <label>
        <span>Password</span>
        <input
          autoComplete="current-password"
          disabled={props.accountBusy}
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
      </label>
      {props.accountError ? <p className="error account-error">{props.accountError}</p> : null}
      <button className="ghost account-submit" type="submit" disabled={props.accountBusy || email.length === 0 || password.length === 0}>
        {props.accountBusy ? 'Logging in...' : 'Log in'}
      </button>
    </form>
  );

  if (session && status === 'expired') {
    return (
      <section className="panel account-section">
        <div>
          <p className="section-kicker">Server account</p>
          <h2>Login expired</h2>
          <p className="muted">{session.user.email}</p>
          <p className="muted">Expires at {formatExpiresAt(session.expiresAt)}</p>
        </div>
        {loginForm}
      </section>
    );
  }

  if (session && status === 'logged-in') {
    const visiblePermissions = session.visiblePermissions.filter(({ key }) => (
      key !== 'canTestSystemIndexes' || session.permissions[key] === true
    ));
    return (
      <section className="panel account-section">
        <div className="account-head">
          <div>
            <p className="section-kicker">Server account</p>
            <h2>{session.user.name ?? session.user.email}</h2>
            <p className="muted">{session.user.email}</p>
            <p className="muted">Logged in</p>
            <p className="muted">Expires at {formatExpiresAt(session.expiresAt)}</p>
          </div>
          <div className="account-actions">
            <button className="ghost" type="button" onClick={props.refreshAccountPermissions} disabled={props.accountBusy}>
              {props.accountBusy ? 'Refreshing...' : 'Refresh permissions'}
            </button>
            <button className="ghost" type="button" onClick={props.logoutAccount} disabled={props.accountBusy}>
              Log out
            </button>
          </div>
        </div>
        <div className="permission-grid">
          {visiblePermissions.map((permission) => (
            <div className="permission-row" key={permission.key}>
              <span>{permission.label}</span>
              <strong className={session.permissions[permission.key] ? 'enabled' : 'disabled'}>
                {session.permissions[permission.key] ? 'Enabled' : 'Disabled'}
              </strong>
            </div>
          ))}
        </div>
        {props.accountError ? <p className="error account-error">{props.accountError}</p> : null}
      </section>
    );
  }

  return (
    <section className="panel account-section">
      <div>
        <p className="section-kicker">Server account</p>
        <h2>Log in</h2>
        <p className="muted">Not logged in</p>
        <p className="muted">Use your server account to load feature permissions for this browser.</p>
      </div>
      {loginForm}
    </section>
  );
}
