CREATE DATABASE IF NOT EXISTS `re-job_db`;
USE `re-job_db`;

CREATE TABLE IF NOT EXISTS `organization` (
  `organization_email` varchar(100) NOT NULL,
  `organization_name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`organization_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `user` (
  `user_email` varchar(100) NOT NULL,
  `user_name` varchar(100) NOT NULL,
  PRIMARY KEY (`user_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `jobs` (
  `organization_email` varchar(100) NOT NULL,
  `job_name` varchar(100) NOT NULL,
  UNIQUE KEY `jobs_un` (`organization_email`,`job_name`),
  CONSTRAINT `jobs_organization_fk` FOREIGN KEY (`organization_email`) REFERENCES `organization` (`organization_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `entities_resume` (
  `user_email` varchar(100) NOT NULL,
  `resume_chunk` varchar(100) NOT NULL,
  KEY `resume_user_fk` (`user_email`),
  CONSTRAINT `resume_user_fk` FOREIGN KEY (`user_email`) REFERENCES `user` (`user_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `entities_job` (
  `organization_email` varchar(100) NOT NULL,
  `job_name` varchar(100) NOT NULL,
  `job_chunk` varchar(100) NOT NULL,
  KEY `entities_job_jobs_fk` (`organization_email`,`job_name`),
  CONSTRAINT `entities_job_jobs_fk` FOREIGN KEY (`organization_email`, `job_name`) REFERENCES `jobs` (`organization_email`, `job_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `match` (
  `user_email` varchar(100) DEFAULT NULL,
  `organization_email` varchar(100) DEFAULT NULL,
  `job_name` varchar(100) DEFAULT NULL,
  `match_rate` double DEFAULT NULL,
  UNIQUE KEY `match_un` (`user_email`, `job_name`),
  KEY `match_user_fk` (`user_email`),
  KEY `match_organization_fk` (`organization_email`),
  CONSTRAINT `match_organization_fk` FOREIGN KEY (`organization_email`) REFERENCES `organization` (`organization_email`),
  CONSTRAINT `match_user_fk` FOREIGN KEY (`user_email`) REFERENCES `user` (`user_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;