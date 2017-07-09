# node-mysql-migration

This plugin is create to simplify migration of mysql database migration.

<h2>Using</h2>

<h3>Installing</h3>
`npm install node-mysql-migration` - to install util

<h3>Setup</h3>

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


<h3>File naming convention</h3>

<br />
migration script shoul have the following name template
<br />

```
V(version name)__name_of_script_separated_with_lower_underline.sql

#example
V1__init_tables.sql
V2__add_new_column.sql
```

<br />
inside migrations file you should wtire migrations script in plain SQL

<h2><b>WARNING</b></h2>

for now migration support only one command in migration script.
<br />
If you migration script contains the following
```sql
ALTER TABLE `tbl_name`
    ADD COLUMN `column_name` VARCHAR(250);
    
ALTER TABLE `tbl_name`
    ADD COLUMN `column_name1` VARCHAR(250);
    
UPDATE `tbl_name` SET `column_name`="asd";
```

then migration will fails.
<br />
to solve this <b>split such migration into three separate migration</b>

<h2>Commands</h2>

run `npm my_db_migrations.js clean` to clean the data base
<br />
run `npm my_db_migrations.js init` to init empty migration scheta table
<br />
run `npm my_db_migrations.js migrate` to apply new migrations to your data base if such exists
