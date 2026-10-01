interface IdentityApi { initialize(options: { client_id: string; nonce: string; auto_select: boolean; callback: (data: { credential: string }) => void }): void; renderButton(element: HTMLElement, options: { theme: string; size: string; width: number; text: string }): void }
declare global { interface Window { google?: { accounts: { id: IdentityApi } } } }
let pending: Promise<IdentityApi> | undefined;
export function loadGoogle(): Promise<IdentityApi> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (pending) return pending;
  pending = new Promise<IdentityApi>((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    const timer = window.setTimeout(() => { script.remove(); pending = undefined; reject(new Error('Google sign-in did not load. Check your connection and retry.')); }, 15000);
    script.onload = () => { clearTimeout(timer); if (window.google?.accounts.id) resolve(window.google.accounts.id); else { pending = undefined; script.remove(); reject(new Error('Google sign-in is unavailable. Try again.')); } };
    script.onerror = () => { clearTimeout(timer); pending = undefined; script.remove(); reject(new Error('Google sign-in could not load. Check your connection.')); };
    document.head.append(script);
  }); return pending;
}
