// Link do grupy testerów (BETA_GROUP_URL): tylko https, bez danych logowania w adresie; inaczej ukryty.
export function betaGroupUrl() {
  try {
    const u = new URL(String(process.env.BETA_GROUP_URL || '').trim());
    return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.') ? u.href : null;
  } catch {
    return null;
  }
}
