#!/bin/sh

xz -9 < stylish.sql | openssl aes-128-cbc -a -pass pass:... > stylish.enc
git add stylish.enc
rm stylish.sql
