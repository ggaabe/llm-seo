export const buildRobotsTxt = (baseUrl: string, disallow: string[] = ['/admin', '/admin/']) => {
  const lines = ['User-agent: *', 'Allow: /']
  disallow.forEach((path) => {
    lines.push(`Disallow: ${path}`)
  })
  lines.push(`Sitemap: ${baseUrl}/sitemap.xml`)
  lines.push('')
  return lines.join('\n')
}
