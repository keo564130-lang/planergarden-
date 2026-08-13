let description = '123 отметки «Нравится», 4 комментариев — username (@user) от 13 августа 2026 г.: "Мой рецепт"'
const instaRegex = /^[\s\S]*?(?:likes|Нравится)[\s\S]*?(?:comments|комментари)[\s\S]*?(?:-|—)[\s\S]*?:\s*"?([\s\S]*?)"?$/i
const instaMatch = description.match(instaRegex)
if (instaMatch && instaMatch[1]) {
  description = instaMatch[1].trim()
}
console.log('Final:', description)
