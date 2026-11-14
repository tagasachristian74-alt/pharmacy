# E-Pharma

## Run the app

```sh
npm install
cp .env.example .env
npm start
```

Open http://localhost:3000. MySQL must be running for login and the application. For an empty users table, set `DB_ADMIN_PASSWORD` in `.env` to a unique password of at least 12 characters; the first login creates the `admin` account. Create cashier accounts from the admin dashboard. Existing accounts are unchanged. Change any previously seeded demo passwords and deactivate unneeded demo accounts before use. Do not commit `.env`.

## Local persistent database (Docker)

Install and start Docker Desktop first. From this project directory run:

```sh
docker volume create epharma_mysql_data
docker run -d --name epharma-mysql --restart unless-stopped -p 127.0.0.1:3306:3306 -e MYSQL_ROOT_PASSWORD=LocalPharmacy123 -v epharma_mysql_data:/var/lib/mysql -v "$PWD/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro" mysql:8
```

On Windows PowerShell, use `${PWD}` instead of `$PWD`. On first startup MySQL can take a minute to initialize; check `docker logs epharma-mysql`. Set `.env` to `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_USER=root`, `DB_PASSWORD=LocalPharmacy123`, `DB_NAME=epharma_db`, and `DB_SSL=false`, then restart `npm start`. The example password is for local development only. The volume persists data across container restarts. Docker must be running; `--restart unless-stopped` starts this container when Docker starts. To start it manually: `docker start epharma-mysql`.

The initialization script runs only on an empty volume. Do not delete the volume unless you intend to erase all database data. If using an existing database, import `schema.sql` with `mysql -u root -p < schema.sql`; existing tables are not overwritten, and the app adds its supported columns on first API access.

## Always-online database option

Use a managed MySQL-compatible service, such as a managed MySQL instance from Aiven, DigitalOcean, or AWS RDS. You must create and pay for/configure the instance yourself; availability, pricing and any idle limits depend on the provider. Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `.env` using its connection details, and set `DB_SSL=true` if the provider supports a certificate trusted by Node.js. Import the tables into the provider's existing database: remove the `CREATE DATABASE ...;` and `USE epharma_db;` statements from a **copy** of `schema.sql`, then run `mysql --host=HOST --port=PORT --user=USER --password DATABASE < schema-copy.sql` (the client prompts for the password). Your account needs table creation and ALTER privileges. Some providers require a custom CA or other TLS settings; consult their instructions. Restart the app after changing `.env`.

An online database does not keep the app itself online: Node must also run on a hosted server. API access is role-checked against server-side sessions, but this remains a development app and needs a security review before production use. Sessions are in memory (server restart logs users out; multiple instances need a shared session store). Use HTTPS and `COOKIE_SECURE=true` behind a correctly configured proxy; restrict database/network access, establish backups and restore tests, and change any old demo credentials. Login throttling is process-local. Do not expose the development server publicly or use real patient data without a production security review.

## Expiration and branding

In Inventory, add or edit a medicine and enter its batch number, expiration date, and shelf location. Medicines with an expiration date appear in Expiration; search also matches shelf. Each inventory medicine currently has one batch/date/shelf, not multiple batches.

Under Settings, choose an image and click **Save Pharmacy Information**. The saved logo is used for the login screen, dashboard, receipt and browser icon. A server-saved logo is available across devices when they load the app; if the server cannot be reached, browser-only changes are not shared. Use PNG, JPG, WebP, GIF or SVG up to 5 MB.

## Backups

Install the MySQL client tools (`mysqldump` and `mysql_config_editor`). Create a private encrypted client login profile (the password is prompted, not written to the command):

```sh
mysql_config_editor set --login-path=epharma --host=127.0.0.1 --port=3306 --user=root --password
DB_NAME=epharma_db BACKUP_DIR="$HOME/epharma-backups" ./scripts/backup.sh
```

The dump is written with restrictive file permissions and a unique name; an incomplete dump is removed on failure. Store backups outside the project and copy them securely off the machine. Schedule the command with your OS scheduler (for example, cron) only after confirming its absolute paths and MySQL login profile; monitor failures and regularly test restoration into a **separate** database/server using `mysql --login-path=epharma < backup.sql`. Restoring a `--databases` dump can overwrite existing tables, so never test against live data. Encryption, off-site storage, retention and scheduling are not automatically configured.

## POS and receipt notes

The POS currently sells one medicine per transaction. For a Senior/PWD customer the app requires a name and ID, compares the configured promotional price with the 12% VAT-exempt, 20%-discounted price, and uses the lower rounded unit price without stacking discounts. **Have a Philippine tax professional verify eligibility, VAT treatment, rounding and official-receipt requirements before using this for real transactions.** This calculation alone is not a compliance certification. Customer names and ID numbers are stored in the database and printed on receipts; protect access and backups and establish an appropriate privacy and retention policy.

Mark medicines that require a prescription in Inventory. The cashier must check “Prescription verified” before checkout; the system does not authenticate or retain a prescription. Admins can void a completed sale with a reason, restoring its stock; voided sales remain in reports and are excluded from dashboard/net totals. Review physical stock and the return's suitability before reselling any medicine. Print using the receipt button and select 58 mm or 80 mm paper in your printer settings.

Cashier presence shows activity from the current server process and becomes offline after 30 minutes without an authenticated API request; it is not a reliable attendance record. The session has an eight-hour maximum lifetime. Audit logging is best effort and is not a tamper-proof audit system. Existing database tables are upgraded on startup/API access, requiring ALTER and foreign-key privileges; back up before upgrading. Existing sales retain their original cashier names and have a null cashier ID until separately reconciled.

## Inventory, purchases and reports

Purchases must use an existing **Active** supplier; create a supplier under Suppliers before placing a purchase. The inventory reorder level is per medicine. The global Low Stock Alert Level acts as a minimum: the higher of the global level and the medicine's reorder level triggers an alert. Date Format is used for dashboard and transaction dates. Expiration dates use the Asia/Manila calendar: stock is blocked from sale starting the day after its expiration date, and stock expiring within 90 days is flagged. This version still tracks only one batch per medicine.

The Sales report and its CSV include Senior/PWD customer names and ID numbers. Treat exports and printed receipts as sensitive personal data; restrict and secure access. View / Reprint shows a past record, including its void status. Cash tendered and change are not stored, so a reprinted past receipt cannot show those details.

Plaintext stored passwords are no longer accepted. Accounts created by this version use scrypt hashes. If upgrading an old database containing plaintext passwords, make a backup and have an administrator reset those accounts securely before use; do not post passwords or database contents in support requests.

## V9 picture assets

The `assets/` folder includes the supplied picture set. The login, role avatars, Rx callout, notification empty state and available category icons use these images. Vitamins and Maintenance icons were not in the supplied folder, so those categories retain text labels. Feature, alert and cover images are included for future use. To use the supplied pharmacy logo throughout the app, upload `assets/pharmacy-logo.png` in Settings; this does not overwrite an existing custom logo.

## In-progress upgrade: cashier sales visibility

Cashiers only see sales linked to their stable user ID. Historical sales with a NULL cashier ID remain visible to admins only until an administrator verifies and reconciles them. This prevents a reused username from exposing another cashier’s sales.
