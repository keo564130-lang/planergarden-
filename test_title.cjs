const titles = [
  'User Name (@username) on Instagram: "Caption text..."',
  'Имя Фамилия (@user) в Instagram: "Текст..."',
  'Somebody (@somebody) от 13 августа 2026 г.: "Привет"'
];
titles.forEach(t => {
  const m = t.match(/^(.*?)\s*(?:on Instagram|в Instagram|от .*? г\.)/i);
  console.log(m ? m[1].trim() : 'Instagram');
});
