SQL Scripts Folder
==================

This folder should contain all database setup scripts from previous sessions.

Required files:
--------------
01-schema.sql - Create all tables
02-rls-policies.sql - Row Level Security policies
03-institution.sql - Institution setup
04-academic-year.sql - Academic year 2024-25
05-users.sql - 30 faculty members
06-subjects.sql - 37 subjects
07-divisions.sql - 22 divisions
08-topics.sql - 876 curriculum topics
09-assignments.sql - 247 faculty assignments

Optional (Historical Data):
--------------------------
PART-01-syllabus-import.sql through PART-10-syllabus-import.sql
(1,618 syllabus entries - adds historical teaching data)

Note:
-----
Currently this folder contains only:
- update-institutions-table.sql

You should copy all SQL files from previous sessions into this folder.

NEW - Migration Script (2026-02-13):
-------------------------------------
MIGRATION_hours_to_lectures.sql
  - Run this BEFORE deploying updated code
  - Renames all "hours" columns to "lectures" terminology
  - Run in Supabase SQL Editor
  - Safe to run multiple times (checks if columns exist first)
