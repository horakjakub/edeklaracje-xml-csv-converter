const fs = require('fs');
const parser = require('xml2json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

fs.readFile('./template.xml', (err, data) => {
  if (err) {
    if (err.code === 'ENOENT') {
      console.error("xml file doesn't exist");
      return;
    }

    throw err;
  }

  const edeklaracjeJson = parser.toJson(data);
  const expensesListJson = JSON.parse(edeklaracjeJson)["tns:JPK"]["tns:ZakupWiersz"];
  const records =
    expensesListJson.map((expense) => {
      const newExpense = {}
      for (prop in expense) {
        newExpense[prop.slice(4, prop.length)] = expense[prop];
      }

      return {
        no: newExpense['LpZakupu'],
        date: newExpense['DataWplywu'],
        invoiceId: newExpense['DowodZakupu'],
        companyName: `NIP: ${newExpense['NrDostawcy']}, ${newExpense['NazwaDostawcy']}`,
        companyAddress: newExpense['AdresDostawcy'],
        otherExpenses: newExpense['K_45'],
        allExpenses: newExpense['K_45'],
        vat: newExpense['K_46'],
      }
    }
    );

  const cswWriter = createCsvWriter({
    path: './template.csv',
    header: [
      {id: 'no', title: 'no'},
      {id: 'date', title: 'date'},
      {id: 'invoiceId', title: 'invoiceId'},
      {id: 'companyName', title: 'companyName'},
      {id: 'companyAddress', title: 'companyAddress'},
      {id: 'description', title: 'description'},
      '7',
      '8',
      '9',
      '10',
      'empty',
      '11',
      '12',
      {id: 'otherExpenses', title: 'otherExpenses'},
      {id: 'allExpenses', title: 'allExpenses'},
      {id: 'vat', title: 'vat (OPTIONAL)'},
    ]
  });

  cswWriter.writeRecords(records)
    .then(() => {
      console.log('".csv" file saved!');
    });
});


