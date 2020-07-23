const parser = require('xml2json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./7451768936.db');
const {StringDecoder} = require('string_decoder');
const decoder = new StringDecoder('utf8');

const yearArg = process.argv.filter(arg => arg.startsWith('-y='))[0];
const monthArg = process.argv.filter(arg => arg.startsWith('-m='))[0];

if (!yearArg || !monthArg) {
  console.log("Please provide month ('-m=6') and year ('-y=2020' f.e.) which should be taken from '.db' file.");
  return;
}

const month = monthArg.slice(3, monthArg.length);
const year = yearArg.slice(3, yearArg.length);
let recordCount = 0;
const records = []
const ROWS_THRESHOLD = 1;

db.serialize(() => {
  db.each(`SELECT * FROM invoices WHERE business_periodMonth="${month}" AND business_periodYear="${year}"`, (err, data) => {
    if (err) throw err;
    const xmlDataBody = decoder.write(data.technical_body)
    const dataBody = JSON.parse(parser.toJson(xmlDataBody));

    if (!dataBody.invoicePurchase) {
      // this is sell invoice 
      return;
    }

    const invoiceElementData = dataBody.invoicePurchase.invoiceElementPurchase;
    const invoiceAddressData = dataBody.invoicePurchase.AKL.AIX;
    const {ANW, ANX, ANZ, ANV} = invoiceAddressData;
    const companyAddress = `${ANW.APG['$t']} ${ANX.APG['$t']}, ${ANZ.APG['$t']} ${ANV.APG['$t']}`;

    const isCarRelated = invoiceElementData.AKI.APG['$t'] === 'true';
    const purchaseDescription = invoiceElementData.AJY.APG['$t'];
    const invoicingDate = new Date(data.business_invoicingDate);
    const y = invoicingDate.getFullYear();
    const m = invoicingDate.getMonth() < 9 ? `0${invoicingDate.getMonth() +1}` :  invoicingDate.getMonth() + 1;
    const d = invoicingDate.getDate() < 10 ? `0${invoicingDate.getDate()}` :  invoicingDate.getDate();
    const { business_netValue, business_taxValue } = data;
    const carRelatedExpenseValue = Math.round((((business_netValue + business_taxValue / 2) * 0.75) + Number.EPSILON) * 100) / 100;
    recordCount++;

    records.push({
      no: recordCount,
      date: `${y}-${m}-${d}`,
      invoiceId: data.business_refid,
      companyName: `NIP: ${data.business_contractorNIP}, ${data.business_contractorName}`,
      description: purchaseDescription,
      carRelatedExpense: isCarRelated ? 'x' : '',
      originalExpense: business_netValue,
      taxIncluded: business_taxValue ? 'x' : '',
      taxCalculated: `=IF(ISBLANK(L${ROWS_THRESHOLD + recordCount}),0,IF(ISBLANK(K${ROWS_THRESHOLD + recordCount}),M${ROWS_THRESHOLD + recordCount}*0.23, (M${ROWS_THRESHOLD + recordCount}*0.23 / 2))`,
      companyAddress,
      otherExpenses: !isCarRelated ? business_netValue : carRelatedExpenseValue, 
      allExpenses: `=P${ROWS_THRESHOLD + recordCount}+Q${ROWS_THRESHOLD + recordCount}`,
    });
  }, () => {
    saveRecordsInCsvFile(year, month, records);
    console.log(records);
  });
});

function saveRecordsInCsvFile(year, month, records) {
  const csvFileName = `${month}_${year}.csv`;

  const cswWriter = createCsvWriter({
    path: csvFileName,
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
      {id: 'carRelatedExpense', title: 'carRelatedExpense'},
      {id: 'taxIncluded', title: 'taxIncluded' },
      {id: 'originalExpense',  title: 'originalExpense' },
      {id: 'taxCalculated', title: 'taxCalculated' },
      '11',
      '12',
      {id: 'otherExpenses', title: 'otherExpenses'},
      {id: 'allExpenses', title: 'allExpenses'},
    ]
  });

  cswWriter.writeRecords(records)
    .then(() => {
      console.log(`"${csvFileName}" file generated!`);
    });
}
