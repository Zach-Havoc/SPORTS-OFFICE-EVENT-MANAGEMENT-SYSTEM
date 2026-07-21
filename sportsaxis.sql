-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 18, 2026 at 03:48 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sportsaxis`
--

-- --------------------------------------------------------

--
-- Table structure for table `announcements`
--

CREATE TABLE `announcements` (
  `id` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `is_tryout` tinyint(1) NOT NULL DEFAULT 1,
  `sport` varchar(255) DEFAULT NULL,
  `coach_id` varchar(255) NOT NULL,
  `coach_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `announcements`
--

INSERT INTO `announcements` (`id`, `title`, `content`, `is_tryout`, `sport`, `coach_id`, `coach_name`, `created_at`, `updated_at`) VALUES
('02564a19-30eb-4603-a69a-fc4d93b03e2b', 'asd', 'asd', 0, 'basketbol', '853afa6e-4faf-44c2-8b7b-e3a785569168', 'Head Coach Saipo', '2026-06-28 02:31:33', '2026-06-28 02:31:33'),
('083d63a3-0bbe-4a1e-825e-502e8397630d', 'test12', 'test123', 1, 'Tryouts', '853afa6e-4faf-44c2-8b7b-e3a785569168', 'Head Coach Saipo', '2026-06-28 02:23:41', '2026-06-28 02:23:41'),
('366d5556-209a-4a7a-afd0-d49a13f14ad9', 'testnotannouncement', 'asda', 0, 'test', '853afa6e-4faf-44c2-8b7b-e3a785569168', 'Head Coach Saipo', '2026-06-28 02:30:49', '2026-06-28 02:30:49'),
('3fa57f7a-3140-4068-8243-d2e87ffd0399', 'tset', 'teset', 1, 'test', '853afa6e-4faf-44c2-8b7b-e3a785569168', 'Head Coach Saipo', '2026-06-28 02:12:57', '2026-06-28 02:12:57'),
('f6923d50-864e-43de-b108-8e4ca664f1ec', 'test', 'tryouts123', 1, 'Tryouts', '853afa6e-4faf-44c2-8b7b-e3a785569168', 'Head Coach Saipo', '2026-06-28 02:12:31', '2026-06-28 02:12:31');

-- --------------------------------------------------------

--
-- Table structure for table `athletes`
--

CREATE TABLE `athletes` (
  `id` varchar(255) NOT NULL,
  `student_id` varchar(255) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `department` varchar(255) DEFAULT NULL,
  `year_level` varchar(255) DEFAULT NULL,
  `course` varchar(255) DEFAULT NULL,
  `coach_id` varchar(255) DEFAULT NULL,
  `sport` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `emergency_contact` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`emergency_contact`)),
  `enrolled_via_code` tinyint(1) NOT NULL DEFAULT 0,
  `enrolled_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `attendance_records`
--

CREATE TABLE `attendance_records` (
  `id` varchar(255) NOT NULL,
  `athlete_id` varchar(255) NOT NULL,
  `event_id` varchar(255) DEFAULT NULL,
  `date` date NOT NULL,
  `status` enum('present','absent','late','excused') NOT NULL DEFAULT 'present',
  `notes` text DEFAULT NULL,
  `recorded_by` varchar(255) NOT NULL,
  `recorded_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`, `description`, `created_at`, `updated_at`) VALUES
('39189c33-307a-46cc-b253-35d93fde9abe', 'Basketball', 'Basketball competitions', '2026-06-28 02:09:06', '2026-06-28 02:09:06'),
('b7b4392d-832b-447a-a5ad-f46b2aacf2b2', 'Swimming', 'Swimming events', '2026-06-28 02:09:06', '2026-06-28 02:09:06'),
('d45176eb-46e3-4e13-9622-10bce60fe560', 'Badminton', 'Badminton competitions', '2026-06-28 02:09:06', '2026-06-28 02:09:06'),
('dff1abc1-339a-42fc-b491-7ac4cb019d11', 'Athletics', 'Track and field events', '2026-06-28 02:09:06', '2026-06-28 02:09:06'),
('f48c6041-450d-4903-9047-072c6c95ca17', 'Volleyball', 'Volleyball competitions', '2026-06-28 02:09:06', '2026-06-28 02:09:06');

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

CREATE TABLE `departments` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `abbreviation` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `departments`
--

INSERT INTO `departments` (`id`, `name`, `abbreviation`, `created_at`, `updated_at`) VALUES
('17eb36dd-4f0e-4af5-b3a3-6379d515444c', 'test', 'test', '2026-06-28 02:11:19', '2026-06-28 02:11:19'),
('2973d547-4ab5-4b63-a834-42d4df63b387', 'College of Information Technology', 'CIT', '2026-06-28 02:09:06', '2026-06-28 02:09:06'),
('299e4d2d-26a1-4367-8d88-cdf14a76e55c', 'College of Education', 'CoEd', '2026-06-28 02:09:06', '2026-06-28 02:09:06'),
('392ee8c0-f1ad-4aee-a8f1-1520709a0de4', 'College of Engineering', 'CoE', '2026-06-28 02:09:06', '2026-06-28 02:09:06'),
('55350a4b-540c-43d1-8a09-6e1eac9352cf', 'College of Business', 'CoB', '2026-06-28 02:09:06', '2026-06-28 02:09:06'),
('7311ffbc-d277-4a1a-a052-8c8ac63e7fba', 'College of Arts and Sciences', 'CAS', '2026-06-28 02:09:06', '2026-06-28 02:09:06');

-- --------------------------------------------------------

--
-- Table structure for table `email_verifications`
--

CREATE TABLE `email_verifications` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `email` varchar(255) NOT NULL,
  `code` varchar(6) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `email_verifications`
--

INSERT INTO `email_verifications` (`id`, `email`, `code`, `expires_at`, `created_at`, `updated_at`) VALUES
(1, '23-75760@g.batstate-u.edu.ph', '549345', '2026-06-28 03:04:27', '2026-06-28 02:41:12', '2026-06-28 02:49:27'),
(2, '22-15952@g.batstate-u.edu.ph', '023960', '2026-06-28 03:08:01', '2026-06-28 02:53:01', '2026-06-28 02:53:01'),
(3, '23-73105@g.batstate-u.edu.ph', '470525', '2026-07-07 06:54:01', '2026-07-07 06:39:01', '2026-07-07 06:39:01');

-- --------------------------------------------------------

--
-- Table structure for table `events`
--

CREATE TABLE `events` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  `schedule` date NOT NULL,
  `start_time` varchar(10) NOT NULL,
  `end_time` varchar(10) NOT NULL,
  `venue_id` varchar(255) DEFAULT NULL,
  `venue_name` varchar(255) DEFAULT NULL,
  `departments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`departments`)),
  `judges` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`judges`)),
  `criteria` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`criteria`)),
  `status` enum('upcoming','ongoing','completed') NOT NULL DEFAULT 'upcoming',
  `qr_token` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `events`
--

INSERT INTO `events` (`id`, `name`, `category`, `schedule`, `start_time`, `end_time`, `venue_id`, `venue_name`, `departments`, `judges`, `criteria`, `status`, `qr_token`, `created_at`, `updated_at`) VALUES
('1421c497-1649-4bde-9733-e78f5274c17e', 'Semi finals', 'Basketball', '2026-06-28', '18:10', '20:10', 'a04a222d-60a0-40f8-9fe3-a8e6ecf0fa84', 'Joson Gym', '[\"College of Arts and Sciences\",\"College of Education\"]', '[{\"id\":\"ca4d12fe-450d-41ef-ad55-906588359cae\",\"name\":\"Expert Judge\",\"email\":\"judge@university.edu\"}]', '[{\"name\":\"test\",\"weight\":100}]', 'upcoming', '0ahQx7Ntyuom70DzlsjIgeFAhjJ3V5xe', '2026-06-28 02:10:57', '2026-06-28 03:10:31'),
('8e5b76a5-24c0-4ff5-b11e-de3f7f9f0389', 'testQR1', 'Basketball', '2026-07-18', '08:36', '09:36', 'a04a222d-60a0-40f8-9fe3-a8e6ecf0fa84', 'Joson Gym', '[\"College of Arts and Sciences\",\"College of Education\"]', '[{\"id\":\"ca4d12fe-450d-41ef-ad55-906588359cae\",\"name\":\"Expert Judge\",\"email\":\"judge@university.edu\"}]', '[{\"name\":\"test\",\"weight\":25},{\"name\":\"saipo\",\"weight\":25},{\"name\":\"kier\",\"weight\":25},{\"name\":\"aeron\",\"weight\":25}]', 'upcoming', '8UCsVtYgZozdTQIgMEzdfTQeRCtVgr6D', '2026-07-17 16:37:03', '2026-07-17 16:38:07'),
('9ec710c8-2d58-42de-8b76-7025df025bfa', 'test1', 'Badminton', '2026-07-18', '10:32', '11:32', 'a04a222d-60a0-40f8-9fe3-a8e6ecf0fa84', 'Joson Gym', '[\"College of Education\",\"College of Information Technology\"]', '[{\"id\":\"ca4d12fe-450d-41ef-ad55-906588359cae\",\"name\":\"Expert Judge\",\"email\":\"judge@university.edu\"}]', '[{\"name\":\"test\",\"weight\":100}]', 'upcoming', 'c74EjOG0QC7qXeYDN8uIwD0Yw4MW17rS', '2026-07-17 16:33:16', '2026-07-17 16:33:59');

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '2024_01_01_000001_create_sportsaxis_tables', 1),
(2, '2026_06_28_101756_add_is_tryout_to_announcements_table', 2),
(3, '2026_07_03_000001_add_ocr_fields_to_scores_table', 3);

-- --------------------------------------------------------

--
-- Table structure for table `performance_records`
--

CREATE TABLE `performance_records` (
  `id` varchar(255) NOT NULL,
  `athlete_id` varchar(255) NOT NULL,
  `athlete_name` varchar(255) NOT NULL,
  `event_id` varchar(255) DEFAULT NULL,
  `event_name` varchar(255) DEFAULT NULL,
  `sport` varchar(255) DEFAULT NULL,
  `metrics` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metrics`)),
  `overall_rating` int(11) NOT NULL DEFAULT 5,
  `coach_notes` text DEFAULT NULL,
  `recorded_by` varchar(255) NOT NULL,
  `recorded_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `personal_access_tokens`
--

CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `personal_access_tokens`
--

INSERT INTO `personal_access_tokens` (`id`, `tokenable_type`, `tokenable_id`, `name`, `token`, `abilities`, `last_used_at`, `expires_at`, `created_at`, `updated_at`) VALUES
(25, 'App\\Models\\User', 'ca4d12fe-450d-41ef-ad55-906588359cae', 'auth_token', 'c6d52a9adc4be5e2ed2c3a5beb245f107dd511b4f4a5d70ed5da50e22855ffe3', '[\"*\"]', '2026-07-17 19:03:23', NULL, '2026-07-17 18:58:19', '2026-07-17 19:03:23'),
(26, 'App\\Models\\User', 'dfb9494c-89ba-4071-98b1-d1c97b8f6e1e', 'auth_token', '4f57460a34603ccd90be04541919508026f58b19f4644dcb1072b5fddd443e72', '[\"*\"]', '2026-07-17 19:01:20', NULL, '2026-07-17 19:01:08', '2026-07-17 19:01:20');

-- --------------------------------------------------------

--
-- Table structure for table `rankings`
--

CREATE TABLE `rankings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `event_id` varchar(255) NOT NULL,
  `department` varchar(255) NOT NULL,
  `total_score` decimal(10,4) NOT NULL,
  `judge_count` int(11) NOT NULL DEFAULT 0,
  `rank` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `rankings`
--

INSERT INTO `rankings` (`id`, `event_id`, `department`, `total_score`, `judge_count`, `rank`, `created_at`, `updated_at`) VALUES
(1, '8e5b76a5-24c0-4ff5-b11e-de3f7f9f0389', '0', 10.0000, 1, 1, '2026-07-17 16:49:37', '2026-07-17 16:49:37'),
(2, '8e5b76a5-24c0-4ff5-b11e-de3f7f9f0389', '1', 10.0000, 1, 2, '2026-07-17 16:49:52', '2026-07-17 16:49:52'),
(3, '9ec710c8-2d58-42de-8b76-7025df025bfa', '0', 5.0000, 1, 1, '2026-07-17 16:59:57', '2026-07-17 16:59:57');

-- --------------------------------------------------------

--
-- Table structure for table `registration_codes`
--

CREATE TABLE `registration_codes` (
  `code` varchar(255) NOT NULL,
  `role` enum('admin','coach','athlete','judge') NOT NULL,
  `label` varchar(255) DEFAULT NULL,
  `used` tinyint(1) NOT NULL DEFAULT 0,
  `used_by` varchar(255) DEFAULT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  `used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `registration_codes`
--

INSERT INTO `registration_codes` (`code`, `role`, `label`, `used`, `used_by`, `created_by`, `used_at`, `expires_at`, `created_at`, `updated_at`) VALUES
('ADMIN001', 'admin', 'Default Admin Code', 1, 'dfb9494c-89ba-4071-98b1-d1c97b8f6e1e', NULL, '2026-06-28 02:09:05', NULL, '2026-06-28 02:09:05', '2026-06-28 02:09:05'),
('ATHL001', 'athlete', 'Default Athlete Code', 1, '48c93163-044e-43fe-86d9-236d58b14cd3', NULL, '2026-06-28 02:09:06', NULL, '2026-06-28 02:09:05', '2026-06-28 02:09:06'),
('B7OX1SLW', 'judge', 'Angel', 1, '09a2394d-1145-4622-96ef-03e2d9948b1c', 'dfb9494c-89ba-4071-98b1-d1c97b8f6e1e', '2026-07-07 08:18:57', '2026-07-08 08:18:18', '2026-07-07 08:18:18', '2026-07-07 08:18:57'),
('COACH001', 'coach', 'Default Coach Code', 1, '853afa6e-4faf-44c2-8b7b-e3a785569168', NULL, '2026-06-28 02:09:06', NULL, '2026-06-28 02:09:05', '2026-06-28 02:09:06'),
('JUDGE001', 'judge', 'Default Judge Code', 1, 'ca4d12fe-450d-41ef-ad55-906588359cae', NULL, '2026-06-28 02:09:06', NULL, '2026-06-28 02:09:05', '2026-06-28 02:09:06'),
('UOZRCPS3', 'athlete', 'Coach: Head Coach Saipo', 0, NULL, '853afa6e-4faf-44c2-8b7b-e3a785569168', NULL, NULL, '2026-06-28 02:57:49', '2026-06-28 02:57:49');

-- --------------------------------------------------------

--
-- Table structure for table `requirements`
--

CREATE TABLE `requirements` (
  `id` varchar(255) NOT NULL,
  `athlete_id` varchar(255) NOT NULL,
  `athlete_name` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `file_url` varchar(255) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `reviewed_by` varchar(255) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `scores`
--

CREATE TABLE `scores` (
  `id` varchar(255) NOT NULL,
  `event_id` varchar(255) NOT NULL,
  `department` varchar(255) NOT NULL,
  `judge_id` varchar(255) NOT NULL,
  `judge_name` varchar(255) NOT NULL,
  `scores` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`scores`)),
  `total_score` decimal(10,4) NOT NULL,
  `submitted_via_qr` tinyint(1) NOT NULL DEFAULT 0,
  `method` varchar(255) NOT NULL DEFAULT 'manual',
  `image_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `scores`
--

INSERT INTO `scores` (`id`, `event_id`, `department`, `judge_id`, `judge_name`, `scores`, `total_score`, `submitted_via_qr`, `method`, `image_url`, `created_at`, `updated_at`) VALUES
('3ffc2e3f-c41f-410f-93ba-773ac6050262', '9ec710c8-2d58-42de-8b76-7025df025bfa', 'College of Information Technology', 'ca4d12fe-450d-41ef-ad55-906588359cae', 'Expert Judge', '[{\"criteria_id\":\"1\",\"value\":5}]', 5.0000, 1, 'manual', NULL, '2026-07-17 16:59:57', '2026-07-17 16:59:57'),
('628f9780-8463-4fb3-9cc6-003ca9d8638e', '8e5b76a5-24c0-4ff5-b11e-de3f7f9f0389', 'College of Arts and Sciences', 'ca4d12fe-450d-41ef-ad55-906588359cae', 'Expert Judge', '[{\"criteria_id\":\"1\",\"value\":10},{\"criteria_id\":\"2\",\"value\":10},{\"criteria_id\":\"3\",\"value\":10},{\"criteria_id\":\"4\",\"value\":10}]', 10.0000, 1, 'manual', NULL, '2026-07-17 16:49:37', '2026-07-17 16:49:37'),
('d1bfe50f-2115-4219-bc7d-f1045fecf2aa', '8e5b76a5-24c0-4ff5-b11e-de3f7f9f0389', 'College of Education', 'ca4d12fe-450d-41ef-ad55-906588359cae', 'Expert Judge', '[{\"criteria_id\":\"1\",\"value\":10},{\"criteria_id\":\"2\",\"value\":10},{\"criteria_id\":\"3\",\"value\":10},{\"criteria_id\":\"4\",\"value\":10}]', 10.0000, 1, 'manual', NULL, '2026-07-17 16:49:52', '2026-07-17 16:49:52');

-- --------------------------------------------------------

--
-- Table structure for table `tryout_applications`
--

CREATE TABLE `tryout_applications` (
  `id` varchar(255) NOT NULL,
  `announcement_id` varchar(255) DEFAULT NULL,
  `sport` varchar(255) DEFAULT NULL,
  `coach_id` varchar(255) DEFAULT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `student_id` varchar(255) NOT NULL,
  `department` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `year_level` varchar(255) NOT NULL DEFAULT '1st Year',
  `status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  `applied_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tryout_applications`
--

INSERT INTO `tryout_applications` (`id`, `announcement_id`, `sport`, `coach_id`, `first_name`, `last_name`, `email`, `student_id`, `department`, `phone`, `year_level`, `status`, `applied_at`, `created_at`, `updated_at`) VALUES
('2745ae23-baa9-4d30-a3ab-442fd1a8b851', '083d63a3-0bbe-4a1e-825e-502e8397630d', 'Tryouts', '853afa6e-4faf-44c2-8b7b-e3a785569168', 'Saipoden', 'Banto', '23-75760@g.batstate-u.edu.ph', '23-75760', 'CICS', '+639456570501', '3rd Year', 'pending', '2026-06-28 02:41:45', '2026-06-28 02:41:45', '2026-06-28 02:41:45'),
('44fe5acf-4668-4deb-a82f-9a464f4537e4', '083d63a3-0bbe-4a1e-825e-502e8397630d', 'Tryouts', '853afa6e-4faf-44c2-8b7b-e3a785569168', 'Jhayvic', 'Banto', '22-15952@g.batstate-u.edu.ph', '23-75760', 'CONHAS', '+639456570501', '2nd Year', 'pending', '2026-06-28 02:54:15', '2026-06-28 02:54:15', '2026-06-28 02:54:15'),
('5a6e3380-5aa5-4440-919c-4bd3dc3b1e31', '083d63a3-0bbe-4a1e-825e-502e8397630d', 'Tryouts', '853afa6e-4faf-44c2-8b7b-e3a785569168', 'Kier', 'Havoc', '23-73105@g.batstate-u.edu.ph', '22-75760', 'CICS', '+639297302898', '3rd Year', 'pending', '2026-07-07 06:39:48', '2026-07-07 06:39:48', '2026-07-07 06:39:48'),
('97d3de6a-6aa6-411b-845b-50ad01f67eb6', '083d63a3-0bbe-4a1e-825e-502e8397630d', 'Tryouts', '853afa6e-4faf-44c2-8b7b-e3a785569168', 'Saipoden', 'Banto', '23-75760@g.batstate-u.edu.ph', '23-75760', 'CICS', '+639456570501', '3rd Year', 'pending', '2026-06-28 02:51:56', '2026-06-28 02:51:56', '2026-06-28 02:51:56');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `role` enum('admin','coach','athlete','judge') NOT NULL,
  `sport` varchar(255) DEFAULT NULL,
  `enrollment_code` varchar(255) DEFAULT NULL,
  `coach_id` varchar(255) DEFAULT NULL,
  `coach_name` varchar(255) DEFAULT NULL,
  `enrolled_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `name`, `role`, `sport`, `enrollment_code`, `coach_id`, `coach_name`, `enrolled_at`, `created_at`, `updated_at`) VALUES
('09a2394d-1145-4622-96ef-03e2d9948b1c', 'angel@university.edu', '$2y$12$XtnWgkwBPvTw7xGDEJzXqOEOYSWSPuAhEqMYvDWEGpQULjkEAwAte', 'Angel Shane', 'judge', NULL, NULL, NULL, NULL, NULL, '2026-07-07 08:18:57', '2026-07-07 08:18:57'),
('48c93163-044e-43fe-86d9-236d58b14cd3', 'athlete@university.edu', '$2y$12$vCUpztF.tFv.e3SOS3A/y.we0n9/waZCbcyT8R97C9bzELdxipAxe', 'Jhayvic', 'athlete', 'Basketball', NULL, '853afa6e-4faf-44c2-8b7b-e3a785569168', 'Head Coach Saipo', '2026-06-28 02:58:17', '2026-06-28 02:09:06', '2026-06-28 03:13:32'),
('853afa6e-4faf-44c2-8b7b-e3a785569168', 'coach@university.edu', '$2y$12$v9KD/2GzdUNl1/W9INpsO.qYdiKHT9DTtf7ZWv62BEbNt/vJjj6RK', 'Head Coach Saipo', 'coach', 'Basketball', 'UOZRCPS3', NULL, NULL, NULL, '2026-06-28 02:09:06', '2026-06-28 02:57:49'),
('ca4d12fe-450d-41ef-ad55-906588359cae', 'judge@university.edu', '$2y$12$rV8FGJ0Mgvq.L7ty0rTPeeGrn0WuNSZ7SXVhL7ytNj0T40MkOhhZK', 'Expert Judge', 'judge', NULL, NULL, NULL, NULL, NULL, '2026-06-28 02:09:06', '2026-06-28 02:09:06'),
('dfb9494c-89ba-4071-98b1-d1c97b8f6e1e', 'admin@university.edu', '$2y$12$0hzwogze7WYfdvdbF82Ko.tvgEO5tMVrXgcUXCzxc3iyDHDeMZ4eu', 'System Admin', 'admin', NULL, NULL, NULL, NULL, NULL, '2026-06-28 02:09:05', '2026-06-28 02:09:05');

-- --------------------------------------------------------

--
-- Table structure for table `venues`
--

CREATE TABLE `venues` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `capacity` int(11) NOT NULL,
  `sports` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`sports`)),
  `location` varchar(255) NOT NULL,
  `facilities` text DEFAULT NULL,
  `status` enum('available','unavailable','maintenance') NOT NULL DEFAULT 'available',
  `created_by` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `venues`
--

INSERT INTO `venues` (`id`, `name`, `type`, `capacity`, `sports`, `location`, `facilities`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
('a04a222d-60a0-40f8-9fe3-a8e6ecf0fa84', 'Joson Gym', 'open', 100, '[\"Volleyball\",\"Badminton\",\"Basketball\"]', 'Beside Cteb  building', NULL, 'available', 'dfb9494c-89ba-4071-98b1-d1c97b8f6e1e', '2026-06-28 02:10:32', '2026-06-28 02:10:32');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `announcements`
--
ALTER TABLE `announcements`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `athletes`
--
ALTER TABLE `athletes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `athletes_student_id_unique` (`student_id`);

--
-- Indexes for table `attendance_records`
--
ALTER TABLE `attendance_records`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `categories_name_unique` (`name`);

--
-- Indexes for table `departments`
--
ALTER TABLE `departments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `departments_name_unique` (`name`);

--
-- Indexes for table `email_verifications`
--
ALTER TABLE `email_verifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `email_verifications_email_index` (`email`);

--
-- Indexes for table `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `events_qr_token_unique` (`qr_token`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `performance_records`
--
ALTER TABLE `performance_records`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  ADD KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`);

--
-- Indexes for table `rankings`
--
ALTER TABLE `rankings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `rankings_event_id_foreign` (`event_id`);

--
-- Indexes for table `registration_codes`
--
ALTER TABLE `registration_codes`
  ADD PRIMARY KEY (`code`);

--
-- Indexes for table `requirements`
--
ALTER TABLE `requirements`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `scores`
--
ALTER TABLE `scores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `scores_event_id_foreign` (`event_id`);

--
-- Indexes for table `tryout_applications`
--
ALTER TABLE `tryout_applications`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_unique` (`email`),
  ADD UNIQUE KEY `users_enrollment_code_unique` (`enrollment_code`);

--
-- Indexes for table `venues`
--
ALTER TABLE `venues`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `email_verifications`
--
ALTER TABLE `email_verifications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `rankings`
--
ALTER TABLE `rankings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `rankings`
--
ALTER TABLE `rankings`
  ADD CONSTRAINT `rankings_event_id_foreign` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `scores`
--
ALTER TABLE `scores`
  ADD CONSTRAINT `scores_event_id_foreign` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
