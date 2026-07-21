fetch(`http://0.0.0.0:3000/api/crm/customers/search`)
  .then(res => res.text())
  .then(text => console.log(text))
  .catch(err => console.error(err));



