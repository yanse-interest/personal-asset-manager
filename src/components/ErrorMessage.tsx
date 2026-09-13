export function ErrorMessage({ id, children }: { id?: string; children: string }) {
  return <p id={id} className="error-message" role="alert">{children}</p>;
}
