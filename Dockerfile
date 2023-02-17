# syntax=docker/dockerfile:1

FROM python:3-buster

COPY requirements.txt /opt/requirements.txt
RUN pip3 install -r /opt/requirements.txt
COPY ./src/check_commit.py  /opt/check_commit.py
CMD [ "python3", "/opt/check_commit.py"]