import express from "express";
import bodyParser from "body-parser";
import pg from "pg"; 

const db = new pg.Client({
    user: "postgres",
    database: "banking_system",
    port: "5432",
    password: "0506",
    host: "localhost"
});
db.connect();

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get('/', (req, res) => {
    res.render('index.ejs');
});

app.get('/customers', async (req, res) => {
    try {
        const results = await db.query('SELECT * FROM customers');
        res.render('Customers.ejs', { customers: results.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/customers/new', (req, res) => {
    res.render('new_customer.ejs');
  });
  
app.post('/customers', async (req, res) => {
    const { name, email, balance } = req.body;
    try {
      await db.query('INSERT INTO customers (name, email, balance) VALUES ($1, $2, $3)', [name, email, balance]);
      res.redirect('/customers');
    } catch (err) {
      console.error(err);
      res.send('Error creating customer');

    }
});

app.get('/customer/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT id, name, email, balance FROM customers WHERE id = $1', [req.params.id]);
        res.render('customer.ejs', { customer: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/transfer/:id', async (req, res) => {
    const { errorMessage, successMessage } = req.query;
    try {
        const customerResult = await db.query('SELECT * FROM customers WHERE id = $1;', [req.params.id]);
        const customer = customerResult.rows[0];
        const allCustomersResult = await db.query('SELECT * FROM customers WHERE id != $1;', [req.params.id]);
        res.render('transfer.ejs', { 
            customer, 
            customers: allCustomersResult.rows, 
            errorMessage, 
            successMessage 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/transfer', async (req, res) => {
    const { senderId, receiverId, amount } = req.body;
    const transferAmount = parseFloat(amount);
    console.log(`Parsed amount: ${transferAmount}`);
    console.log(`Sender is: ${senderId} and receiver is ${receiverId} and amount is ${amount}`);

    try {
        await db.query('BEGIN');

        const senderResult = await db.query('SELECT balance FROM customers WHERE id = $1;', [senderId]);
        const senderBalance = senderResult.rows[0].balance;
        console.log("Sender balance is "+senderBalance);

        if (senderBalance < transferAmount) {
            await db.query('ROLLBACK');
            return res.redirect(`/transfer/${senderId}?errorMessage=Insufficient+funds`);
        }

        const deductBalanceQuery = 'UPDATE customers SET balance = balance - $1 WHERE id = $2;';
        await db.query(deductBalanceQuery, [transferAmount, senderId]);

        const addBalanceQuery = 'UPDATE customers SET balance = balance + $1 WHERE id = $2;';
        await db.query(addBalanceQuery, [transferAmount, receiverId]);

        const recordTransferQuery = 'INSERT INTO transfers (sender_id, receiver_id, amount) VALUES ($1, $2, $3);';
        await db.query(recordTransferQuery, [senderId, receiverId, transferAmount]);

        await db.query('COMMIT');
        res.redirect(`/transfer/${senderId}?successMessage=Transfer+successful`);
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.redirect(`/transfer/${senderId}?errorMessage=Internal+Server+Error`);
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
