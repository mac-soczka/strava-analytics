-- Full refetch job: re-list all activities and re-fetch each detail with include_all_efforts.

ALTER TYPE sync_job_type ADD VALUE IF NOT EXISTS 'full_refetch';
