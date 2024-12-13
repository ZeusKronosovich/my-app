import React, { useState } from 'react';

const SignUpForm = () => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isFormVisible, setFormVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignUpClick = () => {
    setFormVisible(true);
  };

  const handleCancelClick = () => {
    setFormVisible(false);
    setErrorMessage('');
    setLogin('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const response = await fetch('http://localhost:8081/account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ login, password }),
    });

    if (response.ok) {
      alert('Регистрация успешна!');
      setFormVisible(false);
      setLogin('');
      setPassword('');
    } else {
      const status = response.status;
      if (status === 500) {
        setErrorMessage('Логин занят, попробуйте другой.');
      } else {
        const errorText = await response.text();
        setErrorMessage('Ошибка: ' + errorText);
      }
    }
  };

  const handleLoginChange = (e) => {
    const value = e.target.value;
    if (/^[a-zA-Z0-9]*$/.test(value)) {
      setLogin(value);
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    if (/^[a-zA-Z0-9]*$/.test(value)) {
      setPassword(value);
    }
  };

  return (
    <div>
      {!isFormVisible ? (
        <button onClick={handleSignUpClick} className="lfb">Sign Up</button>
      ) : (
        <div>
          <form onSubmit={handleSubmit}>
            <label htmlFor="login">Логин:</label>
            <input
              type="text"
              id="login"
              value={login}
              onChange={handleLoginChange}
              required
            />
            <br />
            <label htmlFor="password">Пароль:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={handlePasswordChange}
              required
            />
            <br />
            <button type="submit" className="lfb">Зарегистрироваться</button>
            <button type="button" onClick={handleCancelClick} className="lfb">Отмена</button>
          </form>
          {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
        </div>
      )}
    </div>
  );
};

export default SignUpForm;