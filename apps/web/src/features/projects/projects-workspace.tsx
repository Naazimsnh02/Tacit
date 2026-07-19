'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Organization, OrganizationRole, Project } from '@tacit/core-schemas';
import { BrandLogo } from '../ui/brand-logo';
import { authenticateWithPassword, type PasswordAuthMode } from './auth';

type OrganizationOption = Pick<Organization, 'id' | 'name' | 'slug' | 'mode'> & { readonly role: OrganizationRole };
interface Session { readonly accessToken: string; readonly email: string | null; }
const sessionKey = 'tacit.production.session';

function loadSession(): Session | null {
  try {
    const value = window.sessionStorage.getItem(sessionKey);
    return value ? JSON.parse(value) as Session : null;
  } catch {
    return null;
  }
}

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'The request could not be completed.');
  return body;
}

export function ProjectsWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [authMode, setAuthMode] = useState<PasswordAuthMode>('sign_in');
  const [organizationName, setOrganizationName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'error' | 'success'>('error');
  const [busy, setBusy] = useState(false);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const writableOrganizations = useMemo(() => organizations.filter(({ role }) => role !== 'viewer'), [organizations]);

  async function refresh(token = session?.accessToken) {
    if (!token) return;
    const [organizationResponse, projectResponse] = await Promise.all([
      api<{ organizations: OrganizationOption[] }>('/api/organizations', token),
      api<{ projects: Project[] }>('/api/projects', token),
    ]);
    setOrganizations(organizationResponse.organizations);
    setProjects(projectResponse.projects);
    setOrganizationId((current) => current && organizationResponse.organizations.some(({ id }) => id === current) ? current : organizationResponse.organizations[0]?.id ?? '');
  }

  useEffect(() => {
    const restored = loadSession();
    setSession(restored);
    if (restored) void refresh(restored.accessToken).catch((error: Error) => {
      setMessageKind('error');
      setMessage(error.message);
    });
  }, []);

  async function submitAuthentication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url || !anonKey) {
      setMessageKind('error');
      return setMessage('Authentication is not configured in this environment.');
    }
    if (authMode === 'sign_up' && password !== passwordConfirmation) {
      setMessageKind('error');
      return setMessage('Passwords do not match.');
    }

    setBusy(true);
    setMessage(null);
    try {
      const result = await authenticateWithPassword({ url, anonKey, mode: authMode, email, password });
      if (!result.session) {
        setAuthMode('sign_in');
        setPassword('');
        setPasswordConfirmation('');
        setMessageKind('success');
        setMessage('Account created. Check your email to confirm it, then sign in.');
        return;
      }
      window.sessionStorage.setItem(sessionKey, JSON.stringify(result.session));
      setSession(result.session);
      await refresh(result.session.accessToken);
    } catch (error) {
      setMessageKind('error');
      setMessage(error instanceof Error ? error.message : authMode === 'sign_in' ? 'Unable to sign in.' : 'Unable to create your account.');
    } finally {
      setBusy(false);
    }
  }

  async function createOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setMessage(null);
    try {
      await api('/api/organizations', session.accessToken, { method: 'POST', body: JSON.stringify({ name: organizationName }) });
      setOrganizationName('');
      await refresh();
    } catch (error) {
      setMessageKind('error');
      setMessage(error instanceof Error ? error.message : 'Unable to create organization.');
    } finally {
      setBusy(false);
    }
  }

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !organizationId) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await api<{ project: Project }>('/api/projects', session.accessToken, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ organizationId, name: projectName, workflowType: 'invoice_exception' }),
      });
      window.location.assign(`/projects/${response.project.id}/evidence`);
    } catch (error) {
      setMessageKind('error');
      setMessage(error instanceof Error ? error.message : 'Unable to create project.');
    } finally {
      setBusy(false);
    }
  }

  if (!session) return <main className="auth-page"><section className="auth-card"><p className="eyebrow">Tacit workspace</p><h1>{authMode === 'sign_in' ? 'Sign in to Tacit' : 'Create your Tacit account'}</h1><p className="muted">Sign in to run knowledge transfer sessions in tenant-isolated projects and compile supervised agents from confirmed workflows.</p><form className="stack" onSubmit={submitAuthentication}><label><span className="field-label">Email</span><input autoComplete="email" className="input" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span className="field-label">Password</span><input autoComplete={authMode === 'sign_in' ? 'current-password' : 'new-password'} className="input" minLength={6} required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{authMode === 'sign_up' ? <label><span className="field-label">Confirm password</span><input autoComplete="new-password" className="input" minLength={6} required type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} /></label> : null}<button className="btn btn-primary" disabled={busy} type="submit">{busy ? authMode === 'sign_in' ? 'Signing in…' : 'Creating account…' : authMode === 'sign_in' ? 'Sign in' : 'Create account'}</button></form><p className="auth-switch">{authMode === 'sign_in' ? 'New to Tacit?' : 'Already have an account?'} <button className="text-button" disabled={busy} type="button" onClick={() => { setAuthMode((current) => current === 'sign_in' ? 'sign_up' : 'sign_in'); setPassword(''); setPasswordConfirmation(''); setMessage(null); }}>{authMode === 'sign_in' ? 'Create an account' : 'Sign in instead'}</button></p>{message ? <p className={`notice${messageKind === 'success' ? ' notice-success' : ''}`} role={messageKind === 'error' ? 'alert' : 'status'}>{message}</p> : null}</section></main>;

  return <main className="production-page"><header className="production-header"><a className="brand" href="/" aria-label="Tacit home"><BrandLogo /></a><div><button className="btn btn-ghost" type="button" onClick={() => { window.sessionStorage.removeItem(sessionKey); setSession(null); setOrganizations([]); setProjects([]); }}>Sign out</button></div></header><section className="production-intro"><div><p className="eyebrow">Authenticated workspace</p><h1>Projects</h1><p className="muted">{session.email ?? 'Signed in'} · Start a knowledge transfer session, then take the confirmed workflow through build, test, and supervised approval.</p></div></section>{message ? <p className={`notice${messageKind === 'success' ? ' notice-success' : ''}`} role={messageKind === 'error' ? 'alert' : 'status'}>{message}</p> : null}<section className="production-grid"><article className="card"><h2>Organization</h2>{organizations.length ? <label><span className="field-label">Active organization</span><select className="select" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} ({organization.role})</option>)}</select></label> : <p className="muted">Create an organization to start a project.</p>}<form className="inline-form" onSubmit={createOrganization}><input className="input" placeholder="Organization name" required value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /><button className="btn btn-secondary" disabled={busy} type="submit">Create organization</button></form></article><article className="card"><h2>New project</h2><p className="muted">Create a project to upload process materials, understand the workflow, and compile a supervised agent.</p><form className="inline-form" onSubmit={createProject}><input className="input" placeholder="Project name" required disabled={!writableOrganizations.length || busy} value={projectName} onChange={(event) => setProjectName(event.target.value)} /><button className="btn btn-primary" disabled={!organizationId || !writableOrganizations.length || busy} type="submit">Create project</button></form></article></section><section className="card"><div className="card-header"><div><h2>Your projects</h2><p className="muted">Only projects belonging to your organizations appear here.</p></div></div>{projects.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Workflow</th><th>Status</th><th>Updated</th></tr></thead><tbody>{projects.map((project) => <tr key={project.id}><td><a href={`/projects/${project.id}/evidence`}>{project.name}</a></td><td>{project.workflowType}</td><td><span className="status status-info">{project.status}</span></td><td>{new Date(project.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="empty">No projects yet.</p>}</section></main>;
}
