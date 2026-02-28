--
-- PostgreSQL database dump
--

\restrict 9m8uLf1ESbe9WG4S2ggpp2BXFI30aQUe50X2FmhOTrGCcBcpiVhXk2o25c9F3d2

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: item_category; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.item_category AS ENUM (
    'metal',
    'plastic',
    'e-waste',
    'wood',
    'glass',
    'paper',
    'textile',
    'rubber',
    'ceramic',
    'composite',
    'artwork',
    'other'
);


ALTER TYPE public.item_category OWNER TO postgres;

--
-- Name: item_condition; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.item_condition AS ENUM (
    'new',
    'like-new',
    'good',
    'fair',
    'poor',
    'scrap'
);


ALTER TYPE public.item_condition OWNER TO postgres;

--
-- Name: item_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.item_status AS ENUM (
    'active',
    'pending',
    'sold',
    'donated',
    'collected',
    'archived'
);


ALTER TYPE public.item_status OWNER TO postgres;

--
-- Name: listing_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.listing_type AS ENUM (
    'sell',
    'donate',
    'scrap'
);


ALTER TYPE public.listing_type OWNER TO postgres;

--
-- Name: task_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.task_status AS ENUM (
    'pending',
    'assigned',
    'collected',
    'delivered',
    'cancelled'
);


ALTER TYPE public.task_status OWNER TO postgres;

--
-- Name: txn_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.txn_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);


ALTER TYPE public.txn_status OWNER TO postgres;

--
-- Name: txn_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.txn_type AS ENUM (
    'item_purchase',
    'item_donation',
    'task_reward',
    'coin_credit',
    'coin_debit',
    'withdrawal',
    'refund'
);


ALTER TYPE public.txn_type OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'user',
    'artist',
    'helper'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: vehicle_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.vehicle_type AS ENUM (
    'cycle',
    'bike',
    'auto',
    'van',
    'on-foot'
);


ALTER TYPE public.vehicle_type OWNER TO postgres;

--
-- Name: check_max_images(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_max_images() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (SELECT COUNT(*) FROM item_images WHERE item_id = NEW.item_id) >= 6 THEN
    RAISE EXCEPTION 'An item cannot have more than 6 images';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_max_images() OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: update_item_search_vector(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_item_search_vector() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')),       'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_item_search_vector() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: artist_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.artist_profiles (
    user_id integer NOT NULL,
    bio character varying(500),
    speciality character varying(120),
    portfolio_url text,
    total_earnings numeric(12,2) DEFAULT 0 NOT NULL,
    artworks_sold integer DEFAULT 0 NOT NULL,
    rating numeric(3,2) DEFAULT 0 NOT NULL,
    rating_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT artist_profiles_rating_check CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric)))
);


ALTER TABLE public.artist_profiles OWNER TO postgres;

--
-- Name: helper_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.helper_profiles (
    user_id integer NOT NULL,
    vehicle_type public.vehicle_type DEFAULT 'on-foot'::public.vehicle_type NOT NULL,
    total_waste_kg numeric(10,2) DEFAULT 0 NOT NULL,
    total_deliveries integer DEFAULT 0 NOT NULL,
    current_address character varying(200),
    current_lat numeric(10,7),
    current_lng numeric(10,7),
    is_available boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.helper_profiles OWNER TO postgres;

--
-- Name: item_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.item_images (
    id integer NOT NULL,
    item_id integer NOT NULL,
    url text NOT NULL,
    filename character varying(255),
    mimetype character varying(80),
    size_bytes integer,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.item_images OWNER TO postgres;

--
-- Name: item_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.item_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.item_images_id_seq OWNER TO postgres;

--
-- Name: item_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.item_images_id_seq OWNED BY public.item_images.id;


--
-- Name: item_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.item_tags (
    item_id integer NOT NULL,
    tag character varying(60) NOT NULL
);


ALTER TABLE public.item_tags OWNER TO postgres;

--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    id integer NOT NULL,
    title character varying(120) NOT NULL,
    description text,
    category public.item_category NOT NULL,
    listing_type public.listing_type NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'INR'::bpchar NOT NULL,
    is_negotiable boolean DEFAULT true NOT NULL,
    weight_kg numeric(8,2),
    condition public.item_condition DEFAULT 'fair'::public.item_condition NOT NULL,
    dim_length numeric(8,2),
    dim_width numeric(8,2),
    dim_height numeric(8,2),
    item_street character varying(200),
    item_city character varying(100),
    item_state character varying(100),
    item_pincode character varying(20),
    item_lat numeric(10,7),
    item_lng numeric(10,7),
    green_coins_reward integer DEFAULT 0 NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    saves integer DEFAULT 0 NOT NULL,
    uploaded_by integer NOT NULL,
    bought_by integer,
    assigned_helper integer,
    status public.item_status DEFAULT 'active'::public.item_status NOT NULL,
    sold_at timestamp with time zone,
    search_vector tsvector,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT items_green_coins_reward_check CHECK ((green_coins_reward >= 0)),
    CONSTRAINT items_price_check CHECK ((price >= (0)::numeric)),
    CONSTRAINT items_saves_check CHECK ((saves >= 0)),
    CONSTRAINT items_views_check CHECK ((views >= 0))
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.items_id_seq OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: task_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_items (
    task_id integer NOT NULL,
    item_id integer NOT NULL
);


ALTER TABLE public.task_items OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    requested_by integer NOT NULL,
    assigned_helper integer,
    pickup_address character varying(300) NOT NULL,
    pickup_city character varying(100),
    pickup_state character varying(100),
    pickup_pincode character varying(20),
    pickup_lat numeric(10,7),
    pickup_lng numeric(10,7),
    dropoff_address character varying(300) NOT NULL,
    dropoff_city character varying(100),
    dropoff_state character varying(100),
    dropoff_pincode character varying(20),
    dropoff_lat numeric(10,7),
    dropoff_lng numeric(10,7),
    estimated_weight_kg numeric(8,2) DEFAULT 0,
    actual_weight_kg numeric(8,2),
    item_description character varying(500),
    scheduled_at timestamp with time zone,
    collected_at timestamp with time zone,
    delivered_at timestamp with time zone,
    status public.task_status DEFAULT 'pending'::public.task_status NOT NULL,
    cancellation_reason text,
    is_urgent boolean DEFAULT false NOT NULL,
    priority smallint DEFAULT 1 NOT NULL,
    green_coins_reward integer DEFAULT 10 NOT NULL,
    reward_paid boolean DEFAULT false NOT NULL,
    distance_km numeric(7,2),
    helper_notes text,
    requester_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tasks_green_coins_reward_check CHECK ((green_coins_reward >= 1)),
    CONSTRAINT tasks_priority_check CHECK (((priority >= 1) AND (priority <= 5)))
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO postgres;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    from_user_id integer,
    to_user_id integer NOT NULL,
    type public.txn_type NOT NULL,
    item_id integer,
    task_id integer,
    amount_inr numeric(12,2) DEFAULT 0 NOT NULL,
    green_coins integer DEFAULT 0 NOT NULL,
    status public.txn_status DEFAULT 'completed'::public.txn_status NOT NULL,
    note character varying(300),
    payment_ref character varying(120),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transactions_amount_inr_check CHECK ((amount_inr >= (0)::numeric))
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(80) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    phone character varying(20),
    avatar_url text,
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    green_coins integer DEFAULT 0 NOT NULL,
    street character varying(200),
    city character varying(100),
    state character varying(100),
    pincode character varying(20),
    is_verified boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_green_coins_check CHECK ((green_coins >= 0))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: item_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_images ALTER COLUMN id SET DEFAULT nextval('public.item_images_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: artist_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.artist_profiles (user_id, bio, speciality, portfolio_url, total_earnings, artworks_sold, rating, rating_count, updated_at) FROM stdin;
3	I transform industrial waste into kinetic sculptures and wall art.	metal sculpture	\N	28450.00	14	4.90	82	2026-02-28 13:56:20.728942+05:30
4	Circuit boards and e-waste become extraordinary digital art in my hands.	e-waste digital art	\N	15200.00	9	4.70	41	2026-02-28 13:56:20.728942+05:30
\.


--
-- Data for Name: helper_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.helper_profiles (user_id, vehicle_type, total_waste_kg, total_deliveries, current_address, current_lat, current_lng, is_available, updated_at) FROM stdin;
5	bike	128.00	48	\N	\N	\N	t	2026-02-28 13:56:20.728942+05:30
6	on-foot	72.00	31	\N	\N	\N	t	2026-02-28 13:56:20.728942+05:30
\.


--
-- Data for Name: item_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.item_images (id, item_id, url, filename, mimetype, size_bytes, sort_order, created_at) FROM stdin;
\.


--
-- Data for Name: item_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.item_tags (item_id, tag) FROM stdin;
1	copper
1	wire
1	electrical
2	pcb
2	circuit
2	electronics
3	teak
3	wood
3	carpentry
4	pet
4	bottles
4	plastic
5	iron
5	rods
5	construction
6	newspaper
6	paper
6	bulk
7	clock
7	gears
7	steampunk
7	antique
8	cotton
8	fabric
8	textile
9	sculpture
9	kinetic
9	copper
9	artwork
10	mandala
10	circuit
10	ewaste
10	wall art
11	bicycle
11	frame
11	steel
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.items (id, title, description, category, listing_type, price, currency, is_negotiable, weight_kg, condition, dim_length, dim_width, dim_height, item_street, item_city, item_state, item_pincode, item_lat, item_lng, green_coins_reward, views, saves, uploaded_by, bought_by, assigned_helper, status, sold_at, search_vector, created_at, updated_at) FROM stdin;
1	Copper Wire Bundle	Clean copper wire salvaged from old electrical wiring. Ideal for kinetic sculptures.	metal	scrap	80.00	INR	t	2.00	fair	\N	\N	\N	\N	Pune	Maharashtra	411001	\N	\N	12	0	0	1	\N	\N	active	\N	'bundl':3A 'clean':4B 'copper':1A,5B 'electr':10B 'ideal':12B 'kinet':14B 'old':9B 'salvag':7B 'sculptur':15B 'wire':2A,6B,11B	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
2	Old Circuit Boards (Mixed)	Assorted PCBs from retired computers and appliances. Great for e-waste art.	e-waste	scrap	120.00	INR	t	1.50	poor	\N	\N	\N	\N	Pune	Maharashtra	411045	\N	\N	18	0	0	2	\N	\N	active	\N	'applianc':11B 'art':17B 'assort':5B 'board':3A 'circuit':2A 'comput':9B 'e':15B 'e-wast':14B 'great':12B 'mix':4A 'old':1A 'pcbs':6B 'retir':8B 'wast':16B	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
3	Teak Wood Offcuts	Small offcuts from a carpentry workshop. Varied sizes, good for mosaic or frame work.	wood	scrap	200.00	INR	t	10.00	good	\N	\N	\N	\N	Pune	Maharashtra	411001	\N	\N	30	0	0	1	\N	\N	active	\N	'carpentri':8B 'frame':16B 'good':12B 'mosaic':14B 'offcut':3A,5B 'size':11B 'small':4B 'teak':1A 'vari':10B 'wood':2A 'work':17B 'workshop':9B	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
4	PET Bottles (50 pcs)	Cleaned and sorted 500ml PET bottles. Ready for upcycling or mosaic art.	plastic	scrap	45.00	INR	t	3.00	good	\N	\N	\N	\N	Pune	Maharashtra	411045	\N	\N	8	0	0	2	\N	\N	active	\N	'50':3A '500ml':8B 'art':16B 'bottl':2A,10B 'clean':5B 'mosaic':15B 'pcs':4A 'pet':1A,9B 'readi':11B 'sort':7B 'upcycl':13B	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
5	Iron Rods Assorted	Mixed iron rods of various lengths from a construction site clearance.	metal	scrap	150.00	INR	t	5.00	fair	\N	\N	\N	\N	Pune	Maharashtra	411001	\N	\N	22	0	0	1	\N	\N	active	\N	'assort':3A 'clearanc':14B 'construct':12B 'iron':1A,5B 'length':9B 'mix':4B 'rod':2A,6B 'site':13B 'various':8B	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
6	Old Newspapers Bulk	Two months of newspapers, good for papier-mâché or packaging.	paper	donate	0.00	INR	t	8.00	fair	\N	\N	\N	\N	Pune	Maharashtra	411045	\N	\N	5	0	0	2	\N	\N	active	\N	'bulk':3A 'good':8B 'month':5B 'mâché':12B 'newspap':2A,7B 'old':1A 'packag':14B 'papier':11B 'papier-mâché':10B 'two':4B	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
7	Broken Clock Parts	Gears, springs, and hands from 3 antique wall clocks. Great for steampunk art.	metal	scrap	60.00	INR	t	0.80	poor	\N	\N	\N	\N	Pune	Maharashtra	411001	\N	\N	9	0	0	1	\N	\N	active	\N	'3':9B 'antiqu':10B 'art':16B 'broken':1A 'clock':2A,12B 'gear':4B 'great':13B 'hand':7B 'part':3A 'spring':5B 'steampunk':15B 'wall':11B	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
8	Cotton Fabric Scraps	Assorted cotton remnants from a garment factory. Colourful and clean.	textile	scrap	55.00	INR	t	4.00	good	\N	\N	\N	\N	Pune	Maharashtra	411045	\N	\N	7	0	0	2	\N	\N	active	\N	'assort':4B 'clean':13B 'colour':11B 'cotton':1A,5B 'fabric':2A 'factori':10B 'garment':9B 'remnant':6B 'scrap':3A	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
9	Scrap Metal Kinetic Sculpture	A balanced kinetic sculpture made entirely from reclaimed copper and iron. Moves with the wind.	artwork	sell	3500.00	INR	t	2.50	new	\N	\N	\N	\N	Pune	Maharashtra	411004	\N	\N	50	0	0	3	\N	\N	active	\N	'balanc':6B 'copper':13B 'entir':10B 'iron':15B 'kinet':3A,7B 'made':9B 'metal':2A 'move':16B 'reclaim':12B 'scrap':1A 'sculptur':4A,8B 'wind':19B	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
10	Circuit Board Mandala Wall Art	Stunning 60cm mandala composed of salvaged circuit boards soldered into geometric patterns.	artwork	sell	2800.00	INR	t	1.20	new	\N	\N	\N	\N	Pune	Maharashtra	411001	\N	\N	40	0	0	4	\N	\N	active	\N	'60cm':7B 'art':5A 'board':2A,13B 'circuit':1A,12B 'compos':9B 'geometr':16B 'mandala':3A,8B 'pattern':17B 'salvag':11B 'solder':14B 'stun':6B 'wall':4A	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
11	Old Bicycle Frame	Steel bicycle frame, suitable for upcycled furniture.	metal	sell	300.00	INR	t	7.00	fair	\N	\N	\N	\N	Pune	Maharashtra	411001	\N	\N	15	0	0	1	3	\N	sold	\N	'bicycl':2A,5B 'frame':3A,6B 'furnitur':10B 'old':1A 'steel':4B 'suitabl':7B 'upcycl':9B	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
\.


--
-- Data for Name: task_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_items (task_id, item_id) FROM stdin;
1	1
1	5
2	4
3	7
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, requested_by, assigned_helper, pickup_address, pickup_city, pickup_state, pickup_pincode, pickup_lat, pickup_lng, dropoff_address, dropoff_city, dropoff_state, dropoff_pincode, dropoff_lat, dropoff_lng, estimated_weight_kg, actual_weight_kg, item_description, scheduled_at, collected_at, delivered_at, status, cancellation_reason, is_urgent, priority, green_coins_reward, reward_paid, distance_km, helper_notes, requester_notes, created_at, updated_at) FROM stdin;
1	1	5	12, MG Road, Shivajinagar	Pune	Maharashtra	411001	\N	\N	Studio 4, FC Road	Pune	Maharashtra	411004	\N	\N	7.00	\N	Copper wire bundle and iron rods	2026-02-28 15:56:21.458+05:30	\N	\N	pending	\N	t	1	45	f	3.40	\N	\N	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
2	2	5	7, Baner Road, Baner	Pune	Maharashtra	411045	\N	\N	EcoHub Warehouse, Aundh	Pune	Maharashtra	411007	\N	\N	3.00	\N	PET Bottles	2026-02-28 14:56:21.458+05:30	2026-02-28 13:26:21.458+05:30	\N	collected	\N	f	1	28	f	2.10	\N	\N	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
3	1	6	23, Karve Nagar, Kothrud	Pune	Maharashtra	411038	\N	\N	Creative Collective, Kasba Peth	Pune	Maharashtra	411011	\N	\N	0.80	0.90	Clock parts and metal scraps	2026-02-28 08:56:21.458+05:30	2026-02-28 09:56:21.458+05:30	2026-02-28 11:56:21.458+05:30	delivered	\N	f	1	35	t	5.70	\N	\N	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, from_user_id, to_user_id, type, item_id, task_id, amount_inr, green_coins, status, note, payment_ref, created_at) FROM stdin;
1	\N	1	coin_credit	\N	\N	0.00	50	completed	Welcome bonus	\N	2026-02-28 13:56:20.728942+05:30
2	\N	2	coin_credit	\N	\N	0.00	50	completed	Welcome bonus	\N	2026-02-28 13:56:20.728942+05:30
3	\N	3	coin_credit	\N	\N	0.00	80	completed	Welcome bonus	\N	2026-02-28 13:56:20.728942+05:30
4	\N	4	coin_credit	\N	\N	0.00	80	completed	Welcome bonus	\N	2026-02-28 13:56:20.728942+05:30
5	\N	5	coin_credit	\N	\N	0.00	100	completed	Welcome bonus	\N	2026-02-28 13:56:20.728942+05:30
6	\N	6	coin_credit	\N	\N	0.00	100	completed	Welcome bonus	\N	2026-02-28 13:56:20.728942+05:30
7	3	1	item_purchase	11	\N	300.00	15	completed	Purchase of Old Bicycle Frame	\N	2026-02-28 13:56:20.728942+05:30
8	\N	6	task_reward	\N	3	0.00	35	completed	Delivery reward for Task #3	\N	2026-02-28 13:56:20.728942+05:30
9	\N	7	coin_credit	\N	\N	0.00	50	completed	Welcome bonus on registration	\N	2026-02-28 14:25:20.270553+05:30
10	\N	8	coin_credit	\N	\N	0.00	50	completed	Welcome bonus on registration	\N	2026-02-28 15:08:09.22802+05:30
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password_hash, phone, avatar_url, role, green_coins, street, city, state, pincode, is_verified, is_active, created_at, updated_at) FROM stdin;
1	Rahul Sharma	rahul@example.com	$2a$12$f7WIuGxOOqNDvyEqdUefC.0rpTyEHsiKbZQtPfEV0XLb/xvZoui4K	+919876543210	\N	user	120	12, MG Road	Pune	Maharashtra	411001	f	t	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
2	Meena Rathod	meena@example.com	$2a$12$f7WIuGxOOqNDvyEqdUefC.0rpTyEHsiKbZQtPfEV0XLb/xvZoui4K	+919765432109	\N	user	85	7, Baner Road	Pune	Maharashtra	411045	f	t	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
3	Priya Kulkarni	priya@example.com	$2a$12$f7WIuGxOOqNDvyEqdUefC.0rpTyEHsiKbZQtPfEV0XLb/xvZoui4K	+919654321098	\N	artist	340	Studio 4, FC Road	Pune	Maharashtra	411004	f	t	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
4	Dev Patil	dev@example.com	$2a$12$f7WIuGxOOqNDvyEqdUefC.0rpTyEHsiKbZQtPfEV0XLb/xvZoui4K	+919543210987	\N	artist	210	23, Koregaon Park	Pune	Maharashtra	411001	f	t	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
5	Ramesh Koli	ramesh@example.com	$2a$12$f7WIuGxOOqNDvyEqdUefC.0rpTyEHsiKbZQtPfEV0XLb/xvZoui4K	+919432109876	\N	helper	680	5, Hadapsar	Pune	Maharashtra	411028	f	t	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
6	Sushila Bai	sushila@example.com	$2a$12$f7WIuGxOOqNDvyEqdUefC.0rpTyEHsiKbZQtPfEV0XLb/xvZoui4K	+919321098765	\N	helper	420	Katraj Area	Pune	Maharashtra	411046	f	t	2026-02-28 13:56:20.728942+05:30	2026-02-28 13:56:20.728942+05:30
7	user	user@user.com	$2a$12$gNLITdTB/CbtFWYAIIcHXuykWFJ3nsa1dfJ653Y2QGpy1rH/sJdXm	\N	\N	user	50	\N	\N	\N	\N	f	t	2026-02-28 14:25:20.270553+05:30	2026-02-28 14:25:20.270553+05:30
8	artist	artist@craft.com	$2a$12$B8lQSOZOtoOiKWCnYoc8l.lKHEcSKq4uCUpE4xUQp39wkATENQPLq	\N	\N	user	50	\N	\N	\N	\N	f	t	2026-02-28 15:08:09.22802+05:30	2026-02-28 15:08:09.22802+05:30
\.


--
-- Name: item_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.item_images_id_seq', 1, false);


--
-- Name: items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.items_id_seq', 11, true);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tasks_id_seq', 3, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 10, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 8, true);


--
-- Name: artist_profiles artist_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.artist_profiles
    ADD CONSTRAINT artist_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: helper_profiles helper_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.helper_profiles
    ADD CONSTRAINT helper_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: item_images item_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_images
    ADD CONSTRAINT item_images_pkey PRIMARY KEY (id);


--
-- Name: item_tags item_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_tags
    ADD CONSTRAINT item_tags_pkey PRIMARY KEY (item_id, tag);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: task_items task_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_pkey PRIMARY KEY (task_id, item_id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_item_images_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_images_item_id ON public.item_images USING btree (item_id, sort_order);


--
-- Name: idx_item_tags_tag; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_item_tags_tag ON public.item_tags USING btree (tag);


--
-- Name: idx_items_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_category ON public.items USING btree (category);


--
-- Name: idx_items_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_city ON public.items USING btree (item_city);


--
-- Name: idx_items_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_created_at ON public.items USING btree (created_at DESC);


--
-- Name: idx_items_listing_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_listing_type ON public.items USING btree (listing_type);


--
-- Name: idx_items_search; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_search ON public.items USING gin (search_vector);


--
-- Name: idx_items_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_status ON public.items USING btree (status);


--
-- Name: idx_items_uploaded_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_items_uploaded_by ON public.items USING btree (uploaded_by);


--
-- Name: idx_tasks_assigned_helper; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_assigned_helper ON public.tasks USING btree (assigned_helper);


--
-- Name: idx_tasks_requested_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_requested_by ON public.tasks USING btree (requested_by);


--
-- Name: idx_tasks_scheduled_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_scheduled_at ON public.tasks USING btree (scheduled_at);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);


--
-- Name: idx_txn_from_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_txn_from_user ON public.transactions USING btree (from_user_id, created_at DESC);


--
-- Name: idx_txn_to_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_txn_to_user ON public.transactions USING btree (to_user_id, created_at DESC);


--
-- Name: idx_txn_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_txn_type ON public.transactions USING btree (type, status);


--
-- Name: idx_users_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_city ON public.users USING btree (city);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: artist_profiles trg_artist_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_artist_profiles_updated_at BEFORE UPDATE ON public.artist_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: item_images trg_check_max_images; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_check_max_images BEFORE INSERT ON public.item_images FOR EACH ROW EXECUTE FUNCTION public.check_max_images();


--
-- Name: helper_profiles trg_helper_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_helper_profiles_updated_at BEFORE UPDATE ON public.helper_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: items trg_items_search_vector; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_items_search_vector BEFORE INSERT OR UPDATE OF title, description ON public.items FOR EACH ROW EXECUTE FUNCTION public.update_item_search_vector();


--
-- Name: items trg_items_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tasks trg_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: artist_profiles artist_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.artist_profiles
    ADD CONSTRAINT artist_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: helper_profiles helper_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.helper_profiles
    ADD CONSTRAINT helper_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: item_images item_images_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_images
    ADD CONSTRAINT item_images_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: item_tags item_tags_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.item_tags
    ADD CONSTRAINT item_tags_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: items items_assigned_helper_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_assigned_helper_fkey FOREIGN KEY (assigned_helper) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: items items_bought_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_bought_by_fkey FOREIGN KEY (bought_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: items items_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: task_items task_items_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: task_items task_items_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_items
    ADD CONSTRAINT task_items_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assigned_helper_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_helper_fkey FOREIGN KEY (assigned_helper) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 9m8uLf1ESbe9WG4S2ggpp2BXFI30aQUe50X2FmhOTrGCcBcpiVhXk2o25c9F3d2

