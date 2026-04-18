-- Expanded creator fields
-- Run in Supabase SQL Editor

ALTER TABLE public.creators ADD COLUMN IF NOT EXISTS ig_handle text;
ALTER TABLE public.creators ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.creators ADD COLUMN IF NOT EXISTS demo text;
ALTER TABLE public.creators ADD COLUMN IF NOT EXISTS deliverables integer DEFAULT 0;
ALTER TABLE public.creators ADD COLUMN IF NOT EXISTS tracker_link text;
ALTER TABLE public.creators ADD COLUMN IF NOT EXISTS website text;

-- Insert all creators
INSERT INTO public.creators (name, address, website, ig_handle, gender, demo, deliverables, specialty, color) VALUES
('Mariah Lukashewich', 'Mariah Lukashewich, 1401 W Brickstone Ct, Appleton, WI 54914', '', 'MariahLukashewich', 'Female', 'Young 30s woman', 15, 'UGC Creator', '#2d7a54'),
('Heaven Heatherly', 'Heaven Heatherly, 11100 North 115th Street Apt 205, Scottsdale, AZ 85259', '', 'heavkinz', 'Female', 'Late 20s woman', 8, 'UGC Creator', '#7c3aed'),
('Taylor Kadletz', 'Taylor Kadletz, 147 Columbine Ln, Sheboygan Falls, WI 53085', 'https://taylorkadletz.com', 'a.well.taylored.life', 'Female', 'Young 30s woman', 4, 'UGC Creator', '#d97706'),
('Vicky Beckman', 'Vicky Beckman, 621 N Lynndale Dr, Appleton WI 54914', '', 'ugc_vicky', 'Female', '50s+ Woman', 4, 'UGC Creator', '#2138ff'),
('Ari Campos Taalib-Di', 'Ari Campos Taalib-Di, 14781 Pomerado Rd #401, Poway CA 92064', 'https://ari-ugc.com/', 'dulla.and.ari.family', 'Female', 'Young 30s woman', 8, 'UGC Creator', '#f87171'),
('Mehr Rajput', 'Mehr Rajput, 470 Dundas St E Trend 3 Unit 1102, Hamilton, ON L8B 2A6', 'https://socialswithmehr.com', 'socialswithmehr', 'Female', 'Mid 20s woman', 10, 'UGC Creator', '#34d399'),
('Sabrina Franzese', 'Sabrina Franzese, 6714 Sloane Pl, Naples FL 34104', 'https://thesabribrand.com', 'thesabribrand', 'Female', 'Early 40s woman', 6, 'UGC Creator', '#0066ff'),
('Niles Jackson', 'Niles, 5329 Owasco st, Cincinnati, oh 45527', 'https://madebyniles.com', 'Madebyniles', 'Male', 'Mid 20s male', 10, 'UGC Creator', '#e11d48'),
('Olivia Lagaly', 'Olivia Lagaly, 1376 Midland Ave Apt. #608, Bronxville, NY 10708', 'https://ugcwitholivia.com', 'olivialagaly', 'Female', 'Young 30s woman', 8, 'UGC Creator', '#8b5cf6'),
('Michelle Lagaly', 'Michelle Lagaly, 9500 Holly Hill, Cincinnati, OH 45243', 'https://itsmichelleugc.com', 'itsmichelleugc', 'Female', '50s+ woman', 6, 'UGC Creator', '#06b6d4'),
('Lydia Davis', 'Lydia Davis, 7237 Hawk Point CT NE, Bemidji MN, 56601', 'http://ugcwithlydia.com', '@lydiacreatesugc', 'Female', 'Late 20s female', 4, 'UGC Creator', '#f59e0b'),
('Justin Davis', 'Justin Davis, 7237 Hawk Point CT NE, Bemidji MN, 56601', 'https://ugcwithjustin.com', 'ugcwithjustin', 'Male', 'Late 20s male', 4, 'UGC Creator', '#10b981'),
('Jenn Palfreyman', 'Jennifer Palfreyman, 530 South 230 West, Orem, Utah 84058', 'https://jenniferpalfreyman.com', 'iamjenndiva', 'Female', 'Mid 30s with kids', 4, 'UGC Creator', '#ec4899'),
('Caleb Griffin', 'Caleb Griffin, 225 Lakeway Dr, Lewisville, NC 27023', 'https://calebugc.my.com', '@calebfitdad', 'Male', 'Late 20s male', 4, 'UGC Creator', '#14b8a6'),
('Kelly Obrien', 'Kelly O''Brien, 1155 17th Ave, Wall, NJ 07719', 'http://kellyobrienugc.com', 'Kellyover60', 'Female', '60+ female', 8, 'UGC Creator', '#a855f7'),
('Krystal Lauren', '4112 W. George St. #2W, Chicago, IL 60641', 'http://www.krystallau.com', '@KrystalLauren', 'Female', '41', 6, 'UGC Creator', '#f43f5e'),
('Dyllan Barnes', 'Sync Media, LLC 6838 N Freestyle Coeur d'' Alene, Idaho 83815', 'https://drive.google.com', 'Dyllan.barnes', 'Male', '32', 4, 'UGC Creator', '#6366f1'),
('Jamie Christensen', 'Jamie Christensensen, 3038 N 650 W, Pleasant Grove, UT 84062', 'https://createswithjar.com', '@createswithjamie', 'Female', '50', 4, 'UGC Creator', '#0ea5e9'),
('Michelle Salisbury', 'Michelle Salisbury, 1902 Fairway Drive, Auburn, Indiana 46706', 'http://www.michelleg.com', '@michelle.gx.ugc', 'Female', '53', 4, 'UGC Creator', '#84cc16'),
('Jen Mahoney', 'Jen Mahoney, 533 W Old Sleigh Lane, Appleton,Wi 54913', 'https://jennifermahor.com', 'jen__mahoney', 'Female', '29', 6, 'UGC Creator', '#f97316'),
('Isabel Campbell', '305 E 86th Street apt 18RW, New York, NY 10028', '', '', 'Female', '31', 4, 'UGC Creator', '#64748b'),
('Keely Mazurek', 'Keeley Mazurek, 805 Chelton Road Unit 7, London, ON, Canada, N6M 0K9', 'https://ugcbykeeley.com', '@keeleymazurek', 'Female', 'Mid 30s female', 4, 'UGC Creator', '#db2777')
ON CONFLICT DO NOTHING;
