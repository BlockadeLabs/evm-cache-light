-- View the value of a setting
SHOW random_page_cost;
SHOW enable_seqscan;
SHOW max_parallel_workers_per_gather;

-- assuming we're using SSD drives, reduce the cost of a random page estimate from 4 to 1
-- which has postgres lean towards using indexes instead of sequential scans for large tables
SET random_page_cost = 1;
ALTER DATABASE evm_cache SET random_page_cost = 1;

-- Set to 2 by default, modest improvement in some large queries (5 to 10%)
SET max_parallel_workers_per_gather = 4;

-- allow us to do sorts in RAM, this is a big fucking database
SET work_mem TO '1 GB';

-- Fuck sequential scans
SET enable_seqscan TO off;

-- See if this helps at all?

-- set to 4 GB on rds already
--SET shared_buffers = '4 GB'

-- set to 8 GB on rds already
--SET effective_cache_size = '12 GB'

-- permanently alter work_mem for a database user
-- ALTER ROLE tx_queue_user SET work_mem TO '1GB';