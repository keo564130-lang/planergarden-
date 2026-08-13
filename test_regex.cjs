const d1 = '1.2M likes, 10K comments - username on August 1, 2026: "This is a test"';
const d2 = '123 отметки «Нравится», 4 комментариев — Username (@user) от 13 августа 2026 г.: "Мой рецепт"';
const d3 = '10 likes, 0 comments - Some User on 12 May: Hello';
const r = /^[\s\S]*?(?:likes|Нравится)[\s\S]*?(?:comments|комментари)[\s\S]*?(?:-|—)[\s\S]*?:\s*"?([\s\S]*?)"?$/i;
console.log(d1.match(r)?.[1]);
console.log(d2.match(r)?.[1]);
console.log(d3.match(r)?.[1]);
