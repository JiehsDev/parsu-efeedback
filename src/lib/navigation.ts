/** Match the most specific visible link, including archive query views. */
export function isNavigationItemActive(
  pathname: string,
  search: string,
  href: string,
  links: string[],
) {
  const current = new URLSearchParams(search);
  const matches = links.filter((link) => {
    const [path, query] = link.split("?");
    if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
    return [...new URLSearchParams(query)].every(([key, value]) => current.get(key) === value);
  });
  matches.sort(
    (a, b) =>
      b.split("?")[0]!.length - a.split("?")[0]!.length ||
      Number(b.includes("?")) - Number(a.includes("?")),
  );
  return matches[0] === href;
}
