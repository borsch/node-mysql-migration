# node-mysql-migration

This plugin is create to simplify migration of mysql database migration.

<h2>Using</h2>

`npm install node-mysql-migration` - to install util

```javascript
# my_db_migrations.js
var mysql = require('mysql');
var migration = require('node-mysql-migration');

migration.migrate(mysql.createConnection({
    host     : 'host',
    user     : 'user',
    password : 'password',
    database : 'database'
}), __dirname + '/migrations');
```
`/migrations` - is a folder where all migrations scripts are located. There is no default value for it so you should specify it


<h2>Commands</h2>

run `npm my_db_migrations.js clean` to clean the data base
<br />
run `npm my_db_migrations.js init` to init empty migration scheta table
<br />
run `npm my_db_migrations.js migrate` to apply new migrations to your data base if such exists
