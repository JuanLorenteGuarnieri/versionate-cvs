/**
 * Nombre "amigable" adivinado a partir de una URL, para cuando el usuario
 * no ha puesto un nombre propio a un enlace (campo tipo "linklist") — se
 * usa tanto al importar un PDF (personalInfoMapping.ts) como al renderizar
 * la preview cuando el campo "label" se ha dejado vacío (preview.ts), para
 * que nunca se acabe mostrando la URL completa sin más si se puede evitar.
 */
export function guessLinkLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    if (/linkedin/i.test(host)) return "LinkedIn";
    if (/github/i.test(host)) return "GitHub";
    if (/gitlab/i.test(host)) return "GitLab";
    return host;
  } catch {
    return url;
  }
}
