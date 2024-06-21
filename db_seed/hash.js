const fs = require('fs');
const bcrypt = require('bcrypt');

fs.readFile('users.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Błąd podczas odczytu pliku:', err);
    return;
  }

  let jsonData;
  try {
    jsonData = JSON.parse(data);
  } catch (parseError) {
    console.error('Błąd parsowania danych JSON:', parseError);
    return;
  }

  jsonData.forEach(user => {
    if (user.password) {
      const hashedPassword = bcrypt.hashSync(user.password, 10);
      user.password = hashedPassword;
    }
  });

  const modifiedData = JSON.stringify(jsonData, null, 2);
  fs.writeFile('users.json', modifiedData, 'utf8', err => {
    if (err) {
      console.error('Błąd podczas zapisu danych do pliku:', err);
      return;
    }
    console.log('Dane zostały zapisane do zmodyfikowanego pliku JSON.');
  });
});