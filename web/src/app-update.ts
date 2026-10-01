export async function requestAppUpdate(update: () => Promise<void>): Promise<string> {
  try {
    await update();
    return 'Update requested. If this page did not reload, reload it to use the new version.';
  } catch {
    return 'App update failed. Reconnect and try again, or reload this page.';
  }
}
