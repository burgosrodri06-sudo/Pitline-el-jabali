/** All paths/amounts come from the trusted server preparation, never the browser. */
export async function transferReceipt(deps: {
  prepare: () => Promise<{ submitted: boolean; objectPath?: string; paymentId?: string }>;
  uploadOrVerify: (path: string) => Promise<void>;
  finalize: () => Promise<{ submitted: boolean; paymentId?: string }>;
}) {
  const attempt = await deps.prepare();
  const validId = (id?: string) => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
  if (attempt.submitted && validId(attempt.paymentId)) return { paymentId: attempt.paymentId!, submitted: true as const };
  if (!attempt.objectPath) throw new Error('receipt_unavailable');
  await deps.uploadOrVerify(attempt.objectPath);
  // Never delete on finalize failure: it may have committed despite network loss.
  const result = await deps.finalize();
  if (!result.submitted || !validId(result.paymentId)) throw new Error('receipt_unavailable');
  return { paymentId: result.paymentId, submitted: true as const };
}
