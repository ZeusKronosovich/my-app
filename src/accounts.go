package main

import (
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt"
	"github.com/gorilla/handlers"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

const (
	host      = "localhost"
	port      = 5432
	user      = "postgres"
	dbname    = "betontrade"
	jwtSecret = "your_secret_key"
)

type Handlers struct {
	dbProvider DatabaseProvider
}

type DatabaseProvider struct {
	db *sql.DB
}

type Account struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

type Order struct {
	Number      int    `json:"o_number"`
	BetonV      int    `json:"o_betonv"`
	BetonMark   string `json:"o_betonmark"`
	BetonTarget string `json:"o_betontarget"`
	BetonTime   string `json:"o_betontime"`
	CreatedTime string `json:"o_createdtime"`
	LogCreater  string `json:"o_logcreater"`
	Price       int    `json:"o_price"`
}

// Обработчики HTTP-запросов

func (h *Handlers) PostAccount(w http.ResponseWriter, r *http.Request) {
	var input Account
	decoder := json.NewDecoder(r.Body)
	err := decoder.Decode(&input)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Хэширование пароля
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Ошибка хэширования пароля", http.StatusInternalServerError)
		return
	}
	input.Password = string(hashedPassword)

	err = h.dbProvider.InsertAccount(input.Login, input.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *Handlers) PostLogin(w http.ResponseWriter, r *http.Request) {
	var input Account
	decoder := json.NewDecoder(r.Body)
	err := decoder.Decode(&input)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var storedPassword string
	err = h.dbProvider.db.QueryRow("SELECT password FROM accounts WHERE login = $1", input.Login).Scan(&storedPassword)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Логин или пароль неверны", http.StatusUnauthorized)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Сравнение введенного пароля с захэшированным
	if err := bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(input.Password)); err != nil {
		http.Error(w, "Логин или пароль неверны", http.StatusUnauthorized)
		return
	}

	// Создаем JWT токен
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"login": input.Login,
		"exp":   time.Now().Add(time.Hour * 1).Unix(),
	})

	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Отправляем токен
	response := map[string]string{
		"token": tokenString,
		"login": input.Login,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func (h *Handlers) GetOrders(w http.ResponseWriter, r *http.Request) {
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		http.Error(w, "Отсутствует токен", http.StatusUnauthorized)
		return
	}

	tokenString = strings.TrimPrefix(tokenString, "Bearer ")

	claims := &jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(jwtSecret), nil
	})
	if err != nil {
		log.Println("Ошибка разбора токена:", err)
		http.Error(w, "Неверный токен", http.StatusUnauthorized)
		return
	}

	login := (*claims)["login"].(string)

	rows, err := h.dbProvider.SelectOrders(login)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var order Order
		if err := rows.Scan(&order.Number, &order.BetonV, &order.BetonMark, &order.BetonTarget, &order.BetonTime, &order.CreatedTime, &order.LogCreater, &order.Price); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		orders = append(orders, order)
	}
	if len(orders) == 0 {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"message": "Вы ещё не сделали ни одного заказа"})
		return
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(orders)
}

func (h *Handlers) PostOrder(w http.ResponseWriter, r *http.Request) {
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		http.Error(w, "Отсутствует токен", http.StatusUnauthorized)
		return
	}

	tokenString = strings.TrimPrefix(tokenString, "Bearer ")

	claims := &jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(jwtSecret), nil
	})
	if err != nil {
		log.Println("Ошибка разбора токена:", err)
		http.Error(w, "Неверный токен", http.StatusUnauthorized)
		return
	}

	login := (*claims)["login"].(string)

	var order Order
	decoder := json.NewDecoder(r.Body)
	err = decoder.Decode(&order)
	if err != nil {
		log.Println("Ошибка декодирования:", err)
		http.Error(w, "Ошибка декодирования JSON", http.StatusBadRequest)
		return
	}

	order.CreatedTime = time.Now().Format(time.RFC3339)
	order.LogCreater = login

	err = h.dbProvider.InsertOrder(order)
	if err != nil {
		http.Error(w, "Ошибка при добавлении заказа", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(order)
}

// Методы для работы с базой данных

func (dp *DatabaseProvider) InsertAccount(login string, password string) error {
	_, err := dp.db.Exec("INSERT INTO accounts (login, password) VALUES ($1, $2)", login, password)
	return err
}

func (dp *DatabaseProvider) SelectOrders(login string) (*sql.Rows, error) {
	return dp.db.Query("SELECT o_number, o_betonv, o_betonmark, o_betontarget, o_betontime, o_createdtime, o_logcreater, o_price FROM orders WHERE o_logcreater = $1", login)
}

func (dp *DatabaseProvider) InsertOrder(order Order) error {
	_, err := dp.db.Exec("INSERT INTO orders (o_betonv, o_betonmark, o_betontarget, o_betontime, o_logcreater, o_createdtime, o_price) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		order.BetonV, order.BetonMark, order.BetonTarget, order.BetonTime, order.LogCreater, order.CreatedTime, order.Price)
	return err
}

func main() {
	address := flag.String("address", "127.0.0.1:8081", "адрес для запуска сервера")
	flag.Parse()

	psqlInfo := fmt.Sprintf("host=%s port=%d user=%s dbname=%s sslmode=disable", host, port, user, dbname)

	db, err := sql.Open("postgres", psqlInfo)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}

	dp := DatabaseProvider{db: db}
	h := Handlers{dbProvider: dp}

	http.HandleFunc("/account", h.PostAccount)
	http.HandleFunc("/login", h.PostLogin)
	http.HandleFunc("/orders", h.GetOrders)
	http.HandleFunc("/orders/create", h.PostOrder)

	cors := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	err = http.ListenAndServe(*address, cors(http.DefaultServeMux))
	if err != nil {
		log.Fatal(err)
	}
}
