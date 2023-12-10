CREATE DATABASE music_player;

USE music_player;

CREATE TABLE users(
id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
username VARCHAR(255) NOT NULL,
email VARCHAR(255) NOT NULL UNIQUE,
password VARCHAR(255) NOT NULL
);


create table favorites(
id int,
songlink varchar(100),
primary key(id,songlink),
foreign key(id) references users(id)
);


create table history(
serialId int auto_increment,
id INT,
songlink varchar(100),
primary key(serialId,id,songlink),
foreign key(id) references users(id)
);

create table prevTrendingSong(
id int auto_increment primary key,
link varchar(50)
);


create table daily_update(
	id int auto_increment primary key,
    link varchar(50),
    title varchar(200)
);


create table ratings(
id int,
songLink varchar(100),
rating int,
primary key(id,songLink),
foreign key(id) references users(id)
);
