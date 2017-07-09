ALTER TABLE `migration_test`
    ADD COLUMN `SECOND_VALUE` VARCHAR(250);

UPDATE `migration_test` SET `SECOND_VALUE`='asd';