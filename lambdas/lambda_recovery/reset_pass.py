import hashlib
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

hashed_password = hash_password('welcome01')
print(f'hashed_password: {hashed_password}', flush=True)