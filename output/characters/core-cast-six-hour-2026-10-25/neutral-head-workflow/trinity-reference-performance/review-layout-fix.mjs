// Apply the same small layout repair to this review and the frozen preceding
// Morpheus page at serve time. Historical files and their screenshots stay exact.
export function stabilizeReviewLayout(html) {
  if (html.includes('data-review-layout="stable-photo-v1"')) return html;
  const resize = "addEventListener('resize', () => {dirty=true;});";
  const photoStatus = "document.querySelector('#status').textContent='已载入游戏角色 · '+currentSha.slice(0,12)";
  if (!html.includes('<style>') || !html.includes(resize) || !html.includes(photoStatus)) {
    throw Error('Unsupported review layout; preserve its source and inspect before patching');
  }
  return html.replace('<style>', '<style data-review-layout="stable-photo-v1">\n#status{flex-basis:100%;white-space:nowrap;min-height:20px}')
    .replace(resize, resize + "\nnew ResizeObserver(()=>{dirty=true;initialDraws=Math.max(initialDraws,2);}).observe(document.querySelector('#comparison'));" )
    .replace(photoStatus, 'if(initialDraws>0) initialDraws--;'+photoStatus);
}
