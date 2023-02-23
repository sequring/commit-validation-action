#!/usr/bin/env python3

import requests
import subprocess
import os
import re
import hashlib
import logging

KEYS_SERVER_URL = "https://keys.openpgp.org/"
DEBUG = True


def is_git_repo():
    return os.path.isdir(".git")


def get_last_commit_email():
    output = subprocess.check_output(
        ["git", "log", "-1", "--pretty=format:%ae"])
    email = output.decode("utf-8")
    return email.strip()


def get_key_by_id(key_id):
    url = KEYS_SERVER_URL + "vks/v1/by-keyid/" + requests.utils.quote(key_id)
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.text
    except requests.exceptions.HTTPError as e:
        url = KEYS_SERVER_URL + "vks/v1/by-fingerprint/" + \
            requests.utils.quote(key_id)
        try:
            response = requests.get(url)
            response.raise_for_status()
            return response.text
        except requests.exceptions.HTTPError as e:
            commit_output = "RSA key not found in " + KEYS_SERVER_URL
            print(f"::set-output name=commit::{commit_output}")
            os._exit(1)


def get_key_by_email(email):
    url = KEYS_SERVER_URL + "vks/v1/by-email/" + requests.utils.quote(email)
    response = requests.get(url)
    response.raise_for_status()
    return response.text


def get_pgp_key_id():
    try:
        output = subprocess.check_output(
            ["git", "verify-commit", "HEAD"], stderr=subprocess.STDOUT).decode("utf-8")
    except subprocess.CalledProcessError as e:
        output = e.output.decode("utf-8")
    pattern = r"using (\w+) key (\w+)"
    match = re.search(pattern, output)
    if match:
        if match.group(1) == "RSA":
            return match.group(2)
        else:
            commit_output = "You should use RSA key"
            print(f"::set-output name=commit::{commit_output}")
            os._exit(1)
    else:
        commit_output = "Commit isn't signing"
        print(f"::set-output name=commit::{commit_output}")
        os._exit(1)


if is_git_repo():
    email = get_last_commit_email()
    key = get_key_by_email(email)
    key_id = get_pgp_key_id()
    key_validation = get_key_by_id(key_id)
    if DEBUG:
        print(key)
        print(key_id)
        print(key_validation)
    if hashlib.sha1(key.encode("utf-8")).hexdigest() != hashlib.sha1(key_validation.encode("utf-8")).hexdigest():

        commit_output = "Commit isn't validation by " + KEYS_SERVER_URL
        print(f"::set-output name=commit::{commit_output}")
        os._exit(1)
    os._exit(0)
else:
    commit_output = "Current directory is not a git repository}"
    print(f"::set-output name=commit::{commit_output}")
    os._exit(1)
