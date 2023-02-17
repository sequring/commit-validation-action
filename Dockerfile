# syntax=docker/dockerfile:1

FROM python:3-buster

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt
COPY ./src/check_commit.py  ./
RUN CMD [ "python3", "check_commit.py"]